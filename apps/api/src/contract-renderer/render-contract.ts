import { Prisma, RenderingImageFormat, RenderingMode } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { renderingHashFromPdf, renderingHashFromImage } from "../lib/record-hashing.js";
import { loadEnv } from "../config/env.js";
import { buildPublicVerifyPageUrl } from "../config/urls.js";
import { buildBaseViewModelFromGoverningRecord, assertSameBaseModel, baseViewModelContentHash } from "./base-contract-template.js";
import { getCertifiedAttestationText, getConvenienceDisclaimerText } from "./base-contract-template.js";
import { applyCertifiedOverlayToBasePdf, applyConvenienceOverlayToBasePdf, drawBaseOnlyPdf } from "./render-pdf.js";
import { pdfToImage } from "./render-image.js";
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "../services/governing-record-audit.js";
import { verifyRecordMessage } from "../services/governing-record-service.js";
import { recordAudit } from "../services/audit-service.js";

export type RenderContractInput = {
  governingRecordId: string;
  orgId: string;
  mode: RenderingMode;
  requestedBy: string;
  /** If set, facsimile timestamp and deterministic outputs for the same build inputs. */
  facsimileAt?: Date;
  /** Default PNG. JPEG = same visual, lossy re-encode; digest differs from PNG. */
  imageFormat?: "png" | "jpeg";
};

export type RenderContractResult = {
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
  imageOutputFormat: RenderingImageFormat;
  generatedAt: string;
};

/**
 * One base contract template (`drawBaseOnlyPdf`); one overlay path per mode.
 * Produces a PDF, then a raster of **that** PDF (same pixels as the PDF layout — no second certification layer on the image).
 */
export async function renderContract(input: RenderContractInput): Promise<RenderContractResult> {
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
