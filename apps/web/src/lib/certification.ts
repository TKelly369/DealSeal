import crypto from "crypto";
import { GoverningRecord } from "@/lib/demo-records";

export type RenderingMode = "certified" | "non_authoritative";

export const CERTIFICATION_STATEMENT =
  "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in DealSeal. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";

function stableSerializeRecord(record: GoverningRecord): string {
  return JSON.stringify({
    id: record.id,
    title: record.title,
    body: record.body,
    parties: record.parties,
    effectiveAt: record.effectiveAt,
    version: record.version,
  });
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function computeRecordHash(record: GoverningRecord): string {
  return sha256(stableSerializeRecord(record));
}

export function computeRenderingHash(record: GoverningRecord, mode: RenderingMode): string {
  const recordHash = computeRecordHash(record);
  return sha256(
    JSON.stringify({
      schema: "dealseal-certified-rendering-v1",
      mode,
      recordId: record.id,
      version: record.version,
      recordHash,
    }),
  );
}
