import { PrismaClient, Prisma, RenderingImageFormat, RenderingMode, type GoverningRecord } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { renderingHashFromPdf, renderingHashFromImage } from "../lib/record-hashing.js";
import { loadEnv } from "../config/env.js";
import { buildPublicVerifyPageUrl } from "../config/urls.js";
import {
  buildBaseContractHTML,
  buildBaseViewModelFromGoverningRecord,
  assertSameBaseModel,
  baseViewModelContentHash,
  injectOverlayIntoBaseContractHTML,
} from "./base-contract-template.js";
import { getCertifiedAttestationText, getConvenienceDisclaimerText } from "./base-contract-template.js";
import { applyCertifiedOverlayToBasePdf, applyConvenienceOverlayToBasePdf, drawBaseOnlyPdf } from "./render-pdf.js";
import { pdfToImage } from "./render-image.js";
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "../services/governing-record-audit.js";
import { verifyRecordMessage } from "../services/governing-record-service.js";
import { recordAudit } from "../services/audit-service.js";
import crypto from "crypto";

const _prismaClientTypeOnly: PrismaClient | undefined = undefined;
void _prismaClientTypeOnly;

type RenderArtifactInput = {
  governingRecordId: string;
  orgId: string;
  mode: RenderingMode;
  requestedBy: string;
  /** If set, facsimile timestamp and deterministic outputs for the same build inputs. */
  facsimileAt?: Date;
  /** Default PNG. JPEG = same visual, lossy re-encode; digest differs from PNG. */
  imageFormat?: "png" | "jpeg";
};

type RenderArtifactResult = {
  renderingEventId: string;
  baseBodyHashSha256: string;
  renderingHashSha256: string;
  imageHashSha256: string;
  /** Governing (authoritative) record content hash on file at time of render */
  recordHashAtRender: string;
  publicRef: string;
  qrVerifyUrl: string;
  mode: RenderingMode;
  recordVersion: number;
  pdfBase64: string;
  imageBase64: string;
  imageMimeType: string;
  imageOutputFormat: "PDF" | "PNG" | "JPEG";
  generatedAt: string;
};

export type RenderContractResult = {
  html: string;
  renderingHash: string;
};

type RenderContractInput = {
  governingRecord: GoverningRecord;
  mode: "CERTIFIED" | "NON_AUTHORITATIVE";
};

function certifiedOverlay(
  governingRecord: GoverningRecord,
  renderingHash: string,
  timestamp: Date,
): string {
  const statement =
    "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in Deal-Scan. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";
  const hashValue = governingRecord.hash || governingRecord.recordHashSha256;
  const verifyUrl = `https://verify.dealseal.local/verify/${governingRecord.id}`;

  return `
    <aside class="overlay certified-overlay">
      <h2>Certified Visual Rendering</h2>
      <div class="meta-grid">
        <div><span>Governing Record ID</span><strong>${governingRecord.id}</strong></div>
        <div><span>Version</span><strong>${governingRecord.version}</strong></div>
        <div><span>Timestamp</span><strong>${timestamp.toISOString()}</strong></div>
        <div><span>Record hash</span><strong>${hashValue}</strong></div>
        <div><span>Rendering hash</span><strong>${renderingHash}</strong></div>
        <div><span>QR verification</span><strong>${verifyUrl}</strong></div>
      </div>
      <p class="statement">${statement}</p>
    </aside>
  `;
}

function nonAuthoritativeOverlay(): string {
  const statement =
    "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";
  return `
    <aside class="overlay convenience-overlay">
      <h2>Non-Authoritative Convenience Copy</h2>
      <p class="statement">${statement}</p>
    </aside>
  `;
}

export async function renderContract({ governingRecord, mode }: RenderContractInput): Promise<RenderContractResult> {
  const baseHtml = buildBaseContractHTML(governingRecord);
  const renderedAt = new Date();
  const baseHash = crypto.createHash("sha256").update(baseHtml).digest("hex");

  const overlayPreview =
    mode === "CERTIFIED" ? certifiedOverlay(governingRecord, baseHash, renderedAt) : nonAuthoritativeOverlay();
  const htmlWithOverlay = injectOverlayIntoBaseContractHTML(baseHtml, overlayPreview);
  const renderingHash = crypto.createHash("sha256").update(htmlWithOverlay).digest("hex");

  const finalOverlay =
    mode === "CERTIFIED" ? certifiedOverlay(governingRecord, renderingHash, renderedAt) : nonAuthoritativeOverlay();
  const html = injectOverlayIntoBaseContractHTML(baseHtml, finalOverlay);

  await prisma.renderEvent.create({
    data: {
      governingId: governingRecord.id,
      type: mode,
      renderedBy: "system",
      renderingHash,
    },
  });

  return { html, renderingHash };
}

/**
 * One base contract template (`drawBaseOnlyPdf`); one overlay path per mode.
 * Produces a PDF, then a raster of **that** PDF (same pixels as the PDF layout — no second certification layer on the image).
 */
export async function renderContractArtifacts(input: RenderArtifactInput): Promise<RenderArtifactResult> {
  const env = loadEnv();
  const gr = await prisma.governingRecord.findFirst({
    where: { id: input.governingRecordId, orgId: input.orgId },
  });
  if (!gr) {
    throw new HttpError(404, "Governing record not found", "NOT_FOUND");
  }
  const { recordVerifies } = verifyRecordMessage(gr);
  if (!recordVerifies) {
    throw new HttpError(409, "Governing record failed integrity check", "RECORD_HASH_MISMATCH");
  }
  const vm1 = buildBaseViewModelFromGoverningRecord(gr);
  const vm2 = buildBaseViewModelFromGoverningRecord(gr);
  assertSameBaseModel(vm1, vm2);
  const baseBodyHashSha256 = baseViewModelContentHash(vm1);
  const basePdf = await drawBaseOnlyPdf(vm1);
  const ts = input.facsimileAt ?? new Date();
  const verifyPageUrl = input.mode === RenderingMode.CERTIFIED ? buildPublicVerifyPageUrl(env, gr.id) : "";

  const pdfBytes = Buffer.from(
    input.mode === RenderingMode.CERTIFIED
      ? await applyCertifiedOverlayToBasePdf(basePdf, {
          verifyUrl: verifyPageUrl,
          recordId: gr.id,
          version: gr.version,
          recordHash: gr.recordHashSha256,
          timestamp: ts,
        })
      : await applyConvenienceOverlayToBasePdf(basePdf, {
          recordId: gr.id,
          version: gr.version,
          recordHash: gr.recordHashSha256,
          timestamp: ts,
        }),
  );
  const renderingHashSha256 = renderingHashFromPdf(pdfBytes);

  const imageAsJpeg = input.imageFormat === "jpeg";
  const imageMime = imageAsJpeg ? "image/jpeg" : "image/png";
  const imageOutFormat: RenderingImageFormat = imageAsJpeg ? RenderingImageFormat.JPEG : RenderingImageFormat.PNG;
  const imageBytes = await pdfToImage(pdfBytes, {
    asJpeg: imageAsJpeg,
    mimeType: imageMime,
  });
  const imageHashSha256 = renderingHashFromImage(imageBytes);

  const attestation =
    input.mode === RenderingMode.CERTIFIED ? getCertifiedAttestationText() : getConvenienceDisclaimerText();
  const ev = await prisma.$transaction(async (db) => {
    return db.renderingEvent.create({
      data: {
        governingRecordId: gr.id,
        governingVersion: gr.version,
        mode: input.mode,
        baseBodyHashSha256,
        renderingHashSha256,
        outputMimeType: "application/pdf",
        outputStorageKey: null,
        imageHashSha256,
        imageMimeType: imageMime,
        imageOutputFormat: imageOutFormat,
        imageStorageKey: null,
        qrVerifyUrl: input.mode === RenderingMode.CERTIFIED ? verifyPageUrl : "",
        recordHashAtRender: gr.recordHashSha256,
        facsimileTimestamp: ts,
        attestationText: attestation,
        requestedByUserId: input.requestedBy,
        clientMetadataJson: { engine: "contract-renderer@3", certVisual: "pdf+raster" } as Prisma.InputJsonValue,
      },
    });
  });
  await appendGoverningRecordAudit({
    governingRecordId: gr.id,
    eventKind: GoverningAuditEventKind.RENDERING_GENERATED,
    message: `Rendering ${input.mode} ${ev.id} (PDF + image)`,
    actorUserId: input.requestedBy,
  });
  await recordAudit({
    orgId: gr.orgId,
    transactionId: gr.transactionId,
    actorUserId: input.requestedBy,
    eventType: "CONTRACT_RENDER",
    action: "RENDER",
    entityType: "RenderingEvent",
    entityId: ev.id,
    resource: "GoverningRecord",
    resourceId: gr.id,
    payload: { mode: input.mode, baseBodyHash: baseBodyHashSha256, renderingHash: renderingHashSha256, imageHash: imageHashSha256 },
  });
  return {
    renderingEventId: ev.id,
    baseBodyHashSha256,
    renderingHashSha256,
    imageHashSha256,
    recordHashAtRender: gr.recordHashSha256,
    publicRef: gr.publicRef,
    qrVerifyUrl: input.mode === RenderingMode.CERTIFIED ? verifyPageUrl : "",
    mode: input.mode,
    recordVersion: gr.version,
    pdfBase64: pdfBytes.toString("base64"),
    imageBase64: imageBytes.toString("base64"),
    imageMimeType: imageMime,
    imageOutputFormat: imageOutFormat,
    generatedAt: ts.toISOString(),
  };
}
