"use server";

import { Prisma } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type FundingDecision = "APPROVE" | "REJECT" | "CONDITION" | "REQUEST_CORRECTION";

async function requireLenderDeal(dealId: string) {
  const session = await auth();
  if (!session?.user) redirect(`/lender/login?next=${encodeURIComponent(`/lender/deals/${dealId}/review`)}`);
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, lenderId: true, dealerId: true, lenderApprovedTerms: true },
  });
  if (!deal || deal.lenderId !== session.user.workspaceId) {
    throw new Error("Deal not found or access denied.");
  }
  return { session, deal };
}

function decisionLabel(d: FundingDecision): string {
  return d.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function submitFundingDecisionAction(formData: FormData): Promise<void> {
  const dealId = String(formData.get("dealId") || "");
  const decision = String(formData.get("decision") || "") as FundingDecision;
  const note = String(formData.get("note") || "").trim();
  if (!dealId) throw new Error("Missing deal.");
  if (!["APPROVE", "REJECT", "CONDITION", "REQUEST_CORRECTION"].includes(decision)) {
    throw new Error("Invalid decision.");
  }
  if ((decision === "CONDITION" || decision === "REQUEST_CORRECTION") && !note) {
    throw new Error("Please include a note for conditions/corrections.");
  }

  const { session, deal } = await requireLenderDeal(dealId);
  const nowIso = new Date().toISOString();
  const existing = (deal.lenderApprovedTerms && typeof deal.lenderApprovedTerms === "object"
    ? deal.lenderApprovedTerms
    : {}) as Record<string, unknown>;
  const history = Array.isArray(existing.decisionHistory) ? existing.decisionHistory : [];
  const next = {
    ...existing,
    latestDecision: decision,
    latestDecisionAt: nowIso,
    latestDecisionBy: session.user.id,
    latestDecisionNote: note || null,
    decisionHistory: [
      ...history,
      { decision, at: nowIso, byUserId: session.user.id, byRole: session.user.role, note: note || null },
    ],
  };

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      lenderApprovedTerms: next as Prisma.InputJsonValue,
    },
  });

  await prisma.notification.create({
    data: {
      workspaceId: deal.dealerId,
      dealId,
      type: "LENDER_FUNDING_DECISION",
      title: `Lender decision: ${decisionLabel(decision)}`,
      message: note || `Lender submitted funding decision: ${decisionLabel(decision)}.`,
      isRead: false,
    },
  });

  await recordDealAuditEvent({
    dealId,
    workspaceId: session.user.workspaceId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    authMethod: "SESSION",
    action: `LENDER_FUNDING_${decision}`,
    entityType: "Deal",
    entityId: dealId,
    payload: { decision, note: note || null },
  });

  revalidatePath(`/lender/deals/${dealId}/review`);
  revalidatePath(`/lender/deal-intake/${dealId}`);
  revalidatePath(`/dealer/deals/${dealId}`);
}
