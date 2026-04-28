import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";
import type { ConsummatedSummary, DealFlowSnapshot } from "./DealFlowClient";
import { DealAlertService } from "@/lib/services/deal-alert.service";
import { CommentService } from "@/lib/services/comment.service";
import { DealDealsWorkspace } from "./DealDealsWorkspace";

function buildConsummatedSummary(raw: unknown): ConsummatedSummary {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fin = o.financials as Record<string, unknown> | undefined;
  const parties = o.parties as Array<Record<string, unknown>> | undefined;
  const buyer = parties?.find((p) => p.role === "BUYER");
  if (!fin || !buyer) return null;
  const af = Number(fin.amountFinanced);
  return {
    buyerLabel: `${String(buyer.firstName)} ${String(buyer.lastName)}`,
    amountFinanced: Number.isFinite(af)
      ? af.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : String(fin.amountFinanced),
    apr: fin.apr != null && fin.apr !== "" ? `${Number(fin.apr)}% APR` : undefined,
    termMonths: fin.termMonths != null ? `${String(fin.termMonths)} mo` : undefined,
    payment:
      fin.paymentAmount != null && fin.paymentAmount !== ""
        ? Number(fin.paymentAmount).toLocaleString("en-US", { style: "currency", currency: "USD" }) + " / mo"
        : undefined,
  };
}

export default async function DealerDealLifecyclePage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { dealId } = await params;
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "dealer");
  if (!deal) redirect("/dealer/dashboard");
  const alerts = await DealAlertService.getAlertsForDeal(dealId);

  const buyer = deal.parties.find((p) => p.role === "BUYER");
  const buyerDisplay = buyer ? `${buyer.firstName} ${buyer.lastName}` : "—";
  const vehicleDisplay = deal.vehicle
    ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model} · VIN ${deal.vehicle.vin}`
    : "—";
  const amountFinancedDisplay = deal.financials
    ? Number(deal.financials.amountFinanced).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

  const snapshot: DealFlowSnapshot = {
    dealId: deal.id,
    status: deal.status,
    state: deal.state,
    authoritativeHash: deal.authoritativeContract?.contentHash ?? null,
    consummatedSummary: buildConsummatedSummary(deal.consummatedData),
    buyerDisplay,
    vehicleDisplay,
    amountFinancedDisplay,
    pendingAmendmentCount: deal.amendments.filter((a) => a.status === "PENDING_LENDER_APPROVAL").length,
    documents: deal.generatedDocuments.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      fileUrl: d.fileUrl,
      version: d.version,
      isAuthoritative: d.isAuthoritative,
      authoritativeContractHash: d.authoritativeContractHash,
    })),
    custodyEvents: deal.custodyEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorRole: e.actorRole,
      timestamp: e.timestamp.toISOString(),
      metadata: e.metadata,
    })),
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      status: a.status,
      title: a.title,
      message: a.message,
      resolutionNote: a.resolutionNote,
      createdAt: a.createdAt.toISOString(),
      audits: a.audits.map((ev) => ({
        id: ev.id,
        action: ev.action,
        actorRole: ev.actorRole,
        recipientUserId: ev.recipientUserId,
        note: ev.note,
        createdAt: ev.createdAt.toISOString(),
      })),
    })),
    complianceChecks: deal.complianceChecks.map((c) => ({
      id: c.id,
      status: c.status,
      explanation: c.explanation,
      ruleSet: c.ruleSet,
    })),
    hdcStatus: deal.negotiableInstrument?.hdcStatus ?? null,
  };

  const timeline = await CommentService.listTimelineForDeal(
    dealId,
    deal.custodyEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorRole: e.actorRole,
      timestamp: e.timestamp,
      metadata: e.metadata,
    })),
  );

  return <DealDealsWorkspace deal={snapshot} timeline={timeline} currentUserId={session.user.id} />;
}
