import { CustodyEventType, type UserRole } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { getDealForSession } from "@/lib/server/deal-access-control";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";

export type DocumentAccessAction = "VIEW" | "DOWNLOAD" | "UPLOAD";

/**
 * Enforces deal tenancy then logs custody + tamper-evident audit trail.
 */
export async function assertDocumentAccessAndLog(input: {
  session: { id: string; role: UserRole; workspaceId: string };
  dealId: string;
  documentId: string;
  action: DocumentAccessAction;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const access = await getDealForSession(input.session, input.dealId);
  if (!access) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  const doc = await prisma.generatedDocument.findFirst({
    where: { id: input.documentId, dealId: input.dealId },
  });
  if (!doc) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const custodyType: CustodyEventType =
    input.action === "DOWNLOAD"
      ? CustodyEventType.DOWNLOADED
      : input.action === "VIEW"
        ? CustodyEventType.VIEWED
        : CustodyEventType.UPLOADED;

  await prisma.documentCustodyEvent.create({
    data: {
      dealId: input.dealId,
      documentId: doc.id,
      eventType: custodyType,
      actorUserId: input.session.id,
      actorRole: input.session.role,
      metadata: {
        action: input.action,
        documentType: doc.documentType,
        version: doc.version,
      },
    },
  });

  await recordDealAuditEvent({
    dealId: input.dealId,
    workspaceId: input.session.workspaceId,
    actorUserId: input.session.id,
    actorRole: input.session.role,
    authMethod: "SESSION",
    action: `DOCUMENT_${input.action}`,
    entityType: "GeneratedDocument",
    entityId: doc.id,
    payload: { documentType: doc.documentType, version: doc.version },
    ipAddress: input.ip ?? undefined,
  });

  return { ok: true };
}
