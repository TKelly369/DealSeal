import { CustodyEventType, type UserRole } from "@/generated/prisma";
import {
  isCreditReportDocument,
  isLenderStaffSessionRole,
  lenderCreditReportDownloadAllowed,
  lenderCreditReportViewAllowed,
} from "@/lib/credit-report-policy";
import { prisma } from "@/lib/db";
import { getDealForSession } from "@/lib/server/deal-access-control";
import { isAdminShellRole } from "@/lib/role-policy";
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

  if (isCreditReportDocument(doc) && isLenderStaffSessionRole(input.session.role) && !isAdminShellRole(input.session.role)) {
    const profile = access.deal.dealerLenderLink?.lenderRuleProfile;
    if (input.action === "VIEW" && !lenderCreditReportViewAllowed(profile)) {
      return { ok: false, reason: "CREDIT_REPORT_VIEW_DISABLED" };
    }
    if (input.action === "DOWNLOAD" && !lenderCreditReportDownloadAllowed(profile)) {
      return { ok: false, reason: "CREDIT_REPORT_DOWNLOAD_DISABLED" };
    }
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
        ...(isCreditReportDocument(doc) ? { documentCategory: "CREDIT_REPORT" } : {}),
      },
    },
  });

  await recordDealAuditEvent({
    dealId: input.dealId,
    workspaceId: input.session.workspaceId,
    actorUserId: input.session.id,
    actorRole: input.session.role,
    authMethod: "SESSION",
    action: isCreditReportDocument(doc) ? `CREDIT_REPORT_${input.action}` : `DOCUMENT_${input.action}`,
    entityType: "GeneratedDocument",
    entityId: doc.id,
    payload: { documentType: doc.documentType, version: doc.version },
    ipAddress: input.ip ?? undefined,
  });

  return { ok: true };
}
