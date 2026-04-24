import { createHash } from "node:crypto";
import { canonicalStringify } from "../services/package-certification-service.js";

export { canonicalStringify, sortDeep } from "../services/package-certification-service.js";

export function sha256HexOfString(s: string): string {
  return createHash("sha256").update(s, "utf-8").digest("hex");
}

export function sha256HexOfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Content-addressed record hash for the authoritative governing JSON payload. */
export function recordHashFromPayload(recordPayload: unknown): string {
  return sha256HexOfString(canonicalStringify(recordPayload));
}

/** Hash of the canonical base contract view model (pre-overlay). */
export function baseTemplateBodyHash(baseViewModel: unknown): string {
  return sha256HexOfString(canonicalStringify(baseViewModel));
}

/** Full PDF bytes after overlays (certified or convenience). */
export function renderingHashFromPdf(pdfBytes: Buffer): string {
  return sha256HexOfBuffer(pdfBytes);
}

/** Image bytes (PNG/JPEG) after overlays — litigation-grade first-class output. */
export function renderingHashFromImage(imageBytes: Buffer): string {
  return sha256HexOfBuffer(imageBytes);
}
