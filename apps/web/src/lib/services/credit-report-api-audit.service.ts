import { CustodyEventType } from "@/generated/prisma";
import { isCreditReportDocument } from "@/lib/credit-report-policy";
import { prisma } from "@/lib/db";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";

/**
 * Audit + custody for lender API ingestion of dealer-uploaded credit reports (binary fetch).
 */
export async function logApiCreditReportDownload(input: {
  dealId: string;
  documentId: string;
  apiKeyId: string;
  workspaceId: string;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const doc = await prisma.generatedDocument.findFirst({
    where: { id: input.documentId, dealId: input.dealId },
  });
  if (!doc) return { ok: false, reason: "NOT_FOUND" };
  if (!isCreditReportDocument(doc)) return { ok: false, reason: "NOT_CREDIT_REPORT" };

  await prisma.documentCustodyEvent.create({
    data: {
      dealId: input.dealId,
      documentId: doc.id,
      eventType: CustodyEventType.DOWNLOADED,
      actorUserId: `apikey:${input.apiKeyId}`,
      actorRole: "API_KEY",
      metadata: {
        action: "DOWNLOAD",
        documentCategory: "CREDIT_REPORT",
        auth: "api_key",
        documentType: doc.documentType,
        version: doc.version,
      },
    },
  });

  await recordDealAuditEvent({
    dealId: input.dealId,
    workspaceId: input.workspaceId,
    actorUserId: null,
    actorRole: "API_KEY",
    authMethod: "API_KEY",
    action: "CREDIT_REPORT_API_DOWNLOAD",
    entityType: "GeneratedDocument",
    entityId: doc.id,
    payload: {
      apiKeyId: input.apiKeyId,
      documentType: doc.documentType,
      version: doc.version,
    },
    ipAddress: input.ip ?? undefined,
  });

  return { ok: true };
}
