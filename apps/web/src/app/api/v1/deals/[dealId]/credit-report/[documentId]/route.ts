import { isCreditReportDocument } from "@/lib/credit-report-policy";
import { lenderCreditReportDownloadAllowed } from "@/lib/credit-report-policy";
import { prisma } from "@/lib/db";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { logApiCreditReportDownload } from "@/lib/services/credit-report-api-audit.service";
import { getDealSealStorage, readLocalObject } from "@/lib/storage/deal-seal-storage";

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
 * Fetch dealer-uploaded credit report bytes for lender LOS ingestion.
 * Audited as custody DOWNLOAD + `CREDIT_REPORT_API_DOWNLOAD` on the deal audit chain.
 *
 * Requires `allowLenderCreditReportDownload` on the dealer–lender link rule profile (default: true).
 */
export async function GET(req: Request, { params }: { params: Promise<{ dealId: string; documentId: string }> }) {
  const api = await requireLenderCreditApi(req);
  if (!api) return unauthorized();

  const { dealId, documentId } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, lenderId: api.workspaceId },
    include: { dealerLenderLink: { select: { lenderRuleProfile: true, status: true } } },
  });
  if (!deal || deal.dealerLenderLink.status !== "APPROVED") return forbidden();
  if (!lenderCreditReportDownloadAllowed(deal.dealerLenderLink.lenderRuleProfile)) {
    return Response.json(
      { error: "Credit report download disabled for this lender link (lenderRuleProfile.allowLenderCreditReportDownload)." },
      { status: 403 },
    );
  }

  const doc = await prisma.generatedDocument.findFirst({
    where: { id: documentId, dealId },
  });
  if (!doc?.storageKey) {
    return Response.json({ error: "Document not found or not in custodial storage." }, { status: 404 });
  }
  if (!isCreditReportDocument(doc)) {
    return Response.json({ error: "Not a credit report document." }, { status: 400 });
  }

  const logged = await logApiCreditReportDownload({
    dealId,
    documentId,
    apiKeyId: api.apiKeyId,
    workspaceId: api.workspaceId,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });
  if (!logged.ok) {
    return Response.json({ error: "Audit failed.", reason: logged.reason }, { status: 500 });
  }

  const storage = getDealSealStorage();
  if (storage.providerLabel === "LOCAL") {
    const buf = await readLocalObject(doc.storageKey);
    if (!buf) {
      return Response.json({ error: "Object not found in local vault." }, { status: 404 });
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credit-report-${documentId.slice(0, 8)}.pdf"`,
      },
    });
  }

  const url = await storage.presignedGetUrl(doc.storageKey, {
    expiresSeconds: 300,
    filename: `credit-report-${documentId.slice(0, 8)}.pdf`,
  });
  return Response.redirect(url);
}
