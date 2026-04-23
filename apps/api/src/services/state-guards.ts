import type { Prisma, TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { findTransitionDef, roleCanUseTransition } from "./state-transition-config.js";
import { assertNoActiveHold } from "./hold-service.js";

const BLOCKER_COMPLETION_STATES = new Set<TransactionState>(["LOCKED"]);

export type StateGuardFailure = {
  code: string;
  message: string;
  details?: Prisma.InputJsonValue;
};

/**
 * All checks except role / transition allow-list. Role & table checks live in `transitionTransaction`.
 */
export async function getTransitionBlockReason(input: {
  orgId: string;
  transactionId: string;
  from: TransactionState;
  to: TransactionState;
  userRoles: import("@prisma/client").UserRole[];
}): Promise<StateGuardFailure | null> {
  const def = findTransitionDef(input.from, input.to);
  if (!def) {
    return {
      code: "INVALID_TRANSITION",
      message: "This state change is not permitted",
      details: { from: input.from, to: input.to },
    };
  }

  if (!roleCanUseTransition(input.from, input.to, input.userRoles)) {
    return { code: "FORBIDDEN", message: "Your role cannot perform this transition" };
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      governingAgreement: true,
      discrepancies: { where: { status: { in: ["OPEN", "ASSIGNED"] } } },
    },
  });
  if (!tx) {
    return { code: "NOT_FOUND", message: "Transaction not found" };
  }

  if (def.requireGoverning && !tx.governingAgreement) {
    return {
      code: "NO_GOVERNING_AGREEMENT",
      message: "A governing agreement must exist on this deal",
    };
  }

  if (
    tx.discrepancies.length > 0 &&
    !bypassesDiscrepancyGuard(input.from, input.to)
  ) {
    return {
      code: "DISCREPANCY_BLOCK",
      message: "Open discrepancies block this path",
      details: { count: tx.discrepancies.length },
    };
  }

  if (input.to === "LOCKED") {
    const verified = await prisma.executedContract.findFirst({
      where: {
        transactionId: input.transactionId,
        verificationStatus: "VERIFIED",
      },
    });
    if (!verified) {
      return {
        code: "EXECUTION_NOT_VERIFIED",
        message: "A verified executed source instrument is required before lock",
        details: {},
      };
    }
  }

  if (BLOCKER_COMPLETION_STATES.has(input.to)) {
    const blockers = await prisma.completionTask.findMany({
      where: {
        transactionId: input.transactionId,
        isBlocker: true,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
      },
      take: 20,
    });
    if (blockers.length > 0) {
      return {
        code: "COMPLETION_BLOCKER",
        message: "Blocker tasks must be cleared before this transition",
        details: { keys: blockers.map((b) => b.key) },
      };
    }
  }

  if (input.to === "GREEN_STAGE_2") {
    const pfi = await prisma.postFundingItem.findMany({
      where: {
        transactionId: input.transactionId,
        isBlocker: true,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      take: 50,
    });
    if (pfi.length > 0) {
      return {
        code: "POST_FUNDING_BLOCKER",
        message: "Blocker post-funding obligations are not satisfied",
        details: { ids: pfi.map((i) => i.id) },
      };
    }
  }

  return null;
}

function bypassesDiscrepancyGuard(
  from: TransactionState,
  to: TransactionState,
): boolean {
  if (to === "DISCREPANCY_RESTRICTED") return true;
  if (from === "DISCREPANCY_RESTRICTED" && (to === "YELLOW" || to === "CONDITIONAL")) {
    return true;
  }
  if (to === "HOLD" || to === "ARCHIVED" || to === "PURGED") return true;
  return false;
}

/**
 * @param tx - optional preloaded, avoids re-fetch
 */
export async function assertNoActiveHoldForTransition(input: {
  orgId: string;
  transactionId: string;
  fromState: TransactionState;
  toState: TransactionState;
}): Promise<void> {
  const exitingHold = input.fromState === "HOLD" && input.toState === "DRAFT";
  await assertNoActiveHold({
    orgId: input.orgId,
    transactionId: input.transactionId,
    allowExitingFromHoldState: exitingHold,
  });
}

