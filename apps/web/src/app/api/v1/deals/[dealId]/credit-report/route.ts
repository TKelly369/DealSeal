import {
  isCreditReportDocument,
  lenderCreditReportDownloadAllowed,
  lenderCreditReportViewAllowed,
} from "@/lib/credit-report-policy";
import { prisma } from "@/lib/db";
import { ApiKeyService } from "@/lib/services/api-key.service";

function unauthorized() {
  return Response.json({ error: "Invalid or insufficient API credentials." }, { status: 401 });
}

function forbidden() {
  return Response.json({ error: "Forbidden." }, { status: 403 });
}

async function requireLenderCreditApi(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  const ctx = await ApiKeyService.validateApiKey(token);
  if (!ctx) return null;
  const scopeOk = ctx.scopes.includes("deals:read") || ctx.scopes.includes("credit_report:read");
  if (!scopeOk) return null;
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { type: true },
  });
  if (ws?.type !== "LENDER") return null;
  return ctx;
}

/**
 * List dealer-uploaded credit report documents for lender API ingestion.
 * DealSeal does not pull credit; files are uploaded by the dealer.
 *
 * Scope: `deals:read` or `credit_report:read`. Workspace must be type LENDER.
 */
export async function GET(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const api = await requireLenderCreditApi(req);
  if (!api) return unauthorized();

  const { dealId } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, lenderId: api.workspaceId },
    include: {
      dealerLenderLink: { select: { lenderRuleProfile: true, status: true } },
      generatedDocuments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal || deal.dealerLenderLink.status !== "APPROVED") return forbidden();

  const profile = deal.dealerLenderLink.lenderRuleProfile;
  const creditDocs = deal.generatedDocuments.filter(isCreditReportDocument);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  return Response.json({
    dealId,
    note: "DealSeal does not pull credit. Documents are dealer-uploaded; each binary fetch is audited.",
    policy: {
      allowLenderCreditReportView: lenderCreditReportViewAllowed(profile),
      allowLenderCreditReportDownload: lenderCreditReportDownloadAllowed(profile),
    },
    documents: creditDocs.map((d) => ({
      id: d.id,
      version: d.version,
      documentType: d.documentType,
      createdAt: d.createdAt.toISOString(),
      integritySha256: d.integritySha256,
      hasStorageKey: Boolean(d.storageKey),
      ingestUrl:
        base && d.storageKey
          ? `${base}/api/v1/deals/${dealId}/credit-report/${d.id}`
          : null,
    })),
  });
}
