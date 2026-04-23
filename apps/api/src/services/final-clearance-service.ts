import { TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { transitionTransaction } from "./state-engine.js";
import { isOverdue, listPostFundingObligations } from "./post-funding-obligation-service.js";
import type { UserRole } from "@prisma/client";
import { recordAudit } from "./audit-service.js";

export async function getFinalClearanceView(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  eligible: boolean;
  state: TransactionState;
  conditions: {
    id: string;
    label: string;
    satisfied: boolean;
    detail?: string;
  }[];
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      discrepancies: { where: { status: { in: ["OPEN", "ASSIGNED"] } } },
      holds: { where: { active: true } },
      authoritativeEmbodiments: { where: { active: true } },
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const isGreenStage2 = tx.state === ("GREEN_STAGE_2" as TransactionState);
  if (isGreenStage2) {
    return {
      eligible: false,
      state: tx.state,
      conditions: [
        {
          id: "terminal",
          label: "Transaction already in Green Stage 2 (final)",
          satisfied: true,
          detail: "No further final clearance",
        },
      ],
    };
  }
  const orgHold = await prisma.hold.findFirst({
    where: { orgId: input.orgId, active: true },
  });
  const { items: pfi } = await listPostFundingObligations({
    orgId: input.orgId,
    transactionId: input.transactionId,
  });
  const blockers = pfi.filter(
    (i) => i.isBlocker && (i.status === "PENDING" || i.status === "IN_PROGRESS"),
  );
  const hasHold = tx.holds.length > 0 || Boolean(orgHold);

  const postFundingish =
    tx.state === "POST_FUNDING_PENDING" || tx.state === "COMPLETED";
  const conditions: { id: string; label: string; satisfied: boolean; detail?: string }[] = [
    {
      id: "funding_path",
      label: "In post-funding or completed (ready for final clearance path)",
      satisfied: postFundingish,
      detail: `state=${tx.state}`,
    },
    { id: "no_discrepancy", label: "No open discrepancies", satisfied: tx.discrepancies.length === 0, detail: `open=${tx.discrepancies.length}` },
    { id: "no_blocker_pfi", label: "No blocker post-funding obligations", satisfied: blockers.length === 0, detail: blockers.length ? `ids=${blockers.map((b) => b.id).join(",")}` : undefined },
    { id: "no_hold", label: "No active hold on transaction/org", satisfied: !hasHold, detail: hasHold ? "hold" : undefined },
    { id: "embodiment", label: "Active authoritative embodiment (recommended)", satisfied: tx.authoritativeEmbodiments.length > 0, detail: "Informational" },
  ];
  for (const it of pfi) {
    if (isOverdue({ dueAt: it.dueAt, status: it.status })) {
      conditions.push({
        id: `overdue_${it.id}`,
        label: `Obligation overdue: ${it.title || it.kind}`,
        satisfied: false,
        detail: it.dueAt?.toISOString() ?? undefined,
      });
    }
  }

  const hardFailed = [conditions[0], conditions[1], conditions[2], conditions[3]].filter(
    (c) => !c.satisfied,
  );
  const anyOverdue = conditions.filter((c) => c.id.startsWith("overdue_") && !c.satisfied);
  const eligible = hardFailed.length === 0 && anyOverdue.length === 0;

  return { eligible, state: tx.state, conditions };
}

export async function completeFinalClearance(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  roles: UserRole[];
}): Promise<{ to: TransactionState }> {
  const view = await getFinalClearanceView({
    orgId: input.orgId,
    transactionId: input.transactionId,
  });
  if (!view.eligible) {
    throw new HttpError(409, "Final clearance preconditions are not met", "FINAL_CLEARANCE", {
      conditions: view.conditions,
    });
  }
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (tx.state === "GREEN_STAGE_2") {
    throw new HttpError(400, "Already in GREEN_STAGE_2", "NOOP", { state: tx.state });
  }
  if (tx.state === "POST_FUNDING_PENDING" || tx.state === "COMPLETED") {
    const tr = await transitionTransaction({
      orgId: input.orgId,
      transactionId: input.transactionId,
      toState: "GREEN_STAGE_2",
      actorUserId: input.actorUserId,
      roles: input.roles,
      reason: "final clearance complete",
      metadata: { clearance: "v1" },
    });
    await recordAudit({
      orgId: input.orgId,
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
      eventType: "FINAL_CLEARANCE",
      action: "FINAL_CLEARANCE_COMPLETE",
      resource: "Transaction",
      resourceId: input.transactionId,
      payload: { to: tr.to },
    });
    return { to: tr.to };
  }
  throw new HttpError(409, "Transaction state does not support final clearance transition", "STATE", {
    state: tx.state,
  });
}
