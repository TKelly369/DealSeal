import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export const GoverningAuditEventKind = {
  RECORD_CREATED: "RECORD_CREATED",
  RECORD_LOCKED: "RECORD_LOCKED",
  RENDERING_GENERATED: "RENDERING_GENERATED",
  VERIFICATION_VIEW: "VERIFICATION_VIEW",
  UNAUTHORIZED_RAW_ACCESS: "UNAUTHORIZED_RAW_ACCESS",
  /** One-off data repair: GoverningRecord created for a deal that locked before the governing-record feature. */
  RECORD_BACKFILL: "RECORD_BACKFILL",
} as const;

export async function appendGoverningRecordAudit(input: {
  governingRecordId: string;
  eventKind: string;
  message?: string;
  actorUserId?: string | null;
  requestMetadataJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      governingRecordId: input.governingRecordId,
      eventKind: input.eventKind,
      message: input.message ?? "",
      actorUserId: input.actorUserId ?? null,
      requestMetadataJson: (input.requestMetadataJson ?? {}) as Prisma.InputJsonValue,
    },
  });
}
