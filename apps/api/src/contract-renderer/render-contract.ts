import { PrismaClient, Prisma, RenderingMode, type GoverningRecord } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { renderingHashFromPdf } from "../lib/record-hashing.js";
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
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "../services/governing-record-audit.js";
import { verifyRecordMessage } from "../services/governing-record-service.js";
import { recordAudit } from "../services/audit-service.js";
import crypto from "crypto";
import QRCode from "qrcode";
import { generatePDF } from "./pdf-generator.js";

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
  imageHashSha256: string | null;
  /** Governing (authoritative) record content hash on file at time of render */
  recordHashAtRender: string;
  publicRef: string;
  qrVerifyUrl: string;
  mode: RenderingMode;
  recordVersion: number;
  pdfBase64: string;
  imageBase64: string | null;
  imageMimeType: string | null;
  imageOutputFormat: "PDF";
  generatedAt: string;
};

export type RenderContractResult = {
  html: string;
  renderingHash: string;
};

type RenderContractInput = {
  governingRecord: GoverningRecord;
  mode: "CERTIFIED" | "NON_AUTHORITATIVE";
  renderedAt?: Date;
  verifyUrl?: string;
};

function certifiedOverlay(
  governingRecord: GoverningRecord,
  renderingHash: string,
  timestamp: Date,
  verifyUrl: string,
  qrCodeDataUrl: string,
): string {
  const statement =
    "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in Deal-Scan. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";
  const hashValue = governingRecord.hash;

  return `
    <aside class="overlay-panel">
      <h4 style="color: #ffffff;">Certified Visual Rendering</h4>
      <div class="overlay-grid">
        <div>
          <p><strong>Governing Record ID</strong></p>
          <p>${governingRecord.id}</p>
        </div>
        <div>
          <p><strong>Version</strong></p>
          <p>${governingRecord.version}</p>
        </div>
        <div>
          <p><strong>Timestamp</strong></p>
          <p>${timestamp.toISOString()}</p>
        </div>
        <div>
          <p><strong>Record hash</strong></p>
          <p>${hashValue}</p>
        </div>
        <div>
          <p><strong>Rendering hash</strong></p>
          <p>${renderingHash}</p>
        </div>
        <div>
          <p><strong>QR verification URL</strong></p>
          <p>${verifyUrl}</p>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <img src="${qrCodeDataUrl}" alt="QR code for record verification" style="width: 120px; height: 120px; border: 1px solid #2a2a2a; background: #050505; padding: 8px;" />
      </div>
      <p class="overlay-note">${statement}</p>
    </aside>
  `;
}

function nonAuthoritativeOverlay(): string {
  const statement =
    "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";
  return `
    <aside class="overlay-panel overlay-convenience">
      <h4 style="color: #ffffff;">Non-Authoritative Convenience Copy</h4>
      <p class="overlay-note">${statement}</p>
    </aside>
  `;
}

export async function renderContract({
  governingRecord,
  mode,
  renderedAt,
  verifyUrl,
}: RenderContractInput): Promise<RenderContractResult> {
  const baseHtml = buildBaseContractHTML(governingRecord);
  const timestamp = renderedAt ?? new Date();
  const resolvedVerifyUrl = verifyUrl ?? `https://dealseal1.com/verify/${governingRecord.id}`;
  const baseHash = crypto.createHash("sha256").update(baseHtml).digest("hex");
  const qrCodeDataUrl =
    mode === "CERTIFIED"
      ? await QRCode.toDataURL(resolvedVerifyUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
        })
      : "";

  const overlayPreview =
    mode === "CERTIFIED"
      ? certifiedOverlay(governingRecord, baseHash, timestamp, resolvedVerifyUrl, qrCodeDataUrl)
      : nonAuthoritativeOverlay();
  const htmlWithOverlay = injectOverlayIntoBaseContractHTML(baseHtml, overlayPreview);
  const renderingHash = crypto.createHash("sha256").update(htmlWithOverlay).digest("hex");

  const finalOverlay =
    mode === "CERTIFIED"
      ? certifiedOverlay(governingRecord, renderingHash, timestamp, resolvedVerifyUrl, qrCodeDataUrl)
      : nonAuthoritativeOverlay();
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
  const ts = input.facsimileAt ?? new Date();
  const verifyPageUrl = input.mode === RenderingMode.CERTIFIED ? buildPublicVerifyPageUrl(env, gr.id) : "";
  const mode: "CERTIFIED" | "NON_AUTHORITATIVE" =
    input.mode === RenderingMode.CERTIFIED ? "CERTIFIED" : "NON_AUTHORITATIVE";
  const htmlResult = await renderContract({
    governingRecord: gr,
    mode,
    renderedAt: ts,
    verifyUrl: verifyPageUrl || `https://dealseal1.com/verify/${gr.id}`,
  });
  const pdfBytes = await generatePDF(htmlResult.html);
  const renderingHashSha256 = renderingHashFromPdf(pdfBytes);

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
        imageHashSha256: null,
        imageMimeType: "application/pdf",
        imageOutputFormat: "PDF",
        imageStorageKey: null,
        qrVerifyUrl: input.mode === RenderingMode.CERTIFIED ? verifyPageUrl : "",
        recordHashAtRender: gr.hash,
        facsimileTimestamp: ts,
        attestationText: attestation,
        requestedByUserId: input.requestedBy,
        clientMetadataJson: { engine: "contract-renderer@html-pdf-v1", output: "pdf" } as Prisma.InputJsonValue,
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
    payload: { mode: input.mode, baseBodyHash: baseBodyHashSha256, renderingHash: renderingHashSha256, imageHash: null },
  });
  return {
    renderingEventId: ev.id,
    baseBodyHashSha256,
    renderingHashSha256,
    imageHashSha256: null,
    recordHashAtRender: gr.hash,
    publicRef: gr.publicRef,
    qrVerifyUrl: input.mode === RenderingMode.CERTIFIED ? verifyPageUrl : "",
    mode: input.mode,
    recordVersion: gr.version,
    pdfBase64: pdfBytes.toString("base64"),
    imageBase64: null,
    imageMimeType: null,
    imageOutputFormat: "PDF",
    generatedAt: ts.toISOString(),
  };
}
