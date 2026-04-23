import type { TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

export async function assertNoActiveHold(params: {
  orgId: string;
  transactionId?: string;
  /** When `true`, transition from `HOLD` → `DRAFT` (or other exit) is not blocked by frozen state. */
  allowExitingFromHoldState?: boolean;
}): Promise<void> {
  const orgHold = await prisma.hold.findFirst({
    where: { orgId: params.orgId, active: true },
  });
  if (orgHold) {
    throw new HttpError(
      423,
      "Organization is on hold",
      "ORG_HOLD",
      { holdId: orgHold.id },
    );
  }
  if (params.transactionId) {
    const txHold = await prisma.hold.findFirst({
      where: { transactionId: params.transactionId, active: true },
    });
    if (txHold) {
      throw new HttpError(
        423,
        "Transaction is on hold",
        "TX_HOLD",
        { holdId: txHold.id },
      );
    }
    const tx = await prisma.transaction.findFirst({
      where: { id: params.transactionId, orgId: params.orgId },
    });
    if (tx?.state === "HOLD" && !params.allowExitingFromHoldState) {
      throw new HttpError(423, "Transaction frozen in HOLD state", "TX_STATE_HOLD");
    }
  }
}

export function isTerminalReadOnlyState(state: TransactionState): boolean {
  return state === "LOCKED" || state === "ARCHIVED" || state === "PURGED";
}

/** Structural / document uploads blocked after execution seal path. */
const NO_PATCH_STATES: Set<TransactionState> = new Set([
  "EXECUTED",
  "EXECUTED_PENDING_VERIFICATION",
  "LOCKED",
  "POST_FUNDING_PENDING",
  "COMPLETED",
  "GREEN_STAGE_2",
  "ARCHIVED",
  "PURGED",
  "HOLD",
]);

export function canPatchDealData(state: TransactionState): boolean {
  if (NO_PATCH_STATES.has(state)) return false;
  return true;
}
