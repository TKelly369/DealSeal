import type {
  ContractLifecyclePhase,
  Prisma,
  TransactionState,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";
import {
  assertNoActiveHoldForTransition,
  getTransitionBlockReason,
} from "./state-guards.js";
import {
  candidateTargets,
  findTransitionDef,
  roleCanUseTransition,
} from "./state-transition-config.js";

/**
 * Authoritative state move: validation, log row, optional audit (when `emitAudit` set).
 * Callers (HTTP) should set `emitAudit: true` for user-driven transitions.
 */
export async function transitionTransaction(input: {
  orgId: string;
  transactionId: string;
  toState: TransactionState;
  actorUserId: string;
  roles: UserRole[];
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  /** Default true in HTTP layer */
  emitAudit?: boolean;
}): Promise<{
  from: TransactionState;
  to: TransactionState;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { governingAgreement: true },
  });
  if (!tx) {
    throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  }

  await assertNoActiveHoldForTransition({
    orgId: input.orgId,
    transactionId: input.transactionId,
    fromState: tx.state,
    toState: input.toState,
  });

  const from = tx.state;
  if (from === input.toState) {
    throw new HttpError(400, "Already in target state", "NOOP", { state: from });
  }

  const def = findTransitionDef(from, input.toState);
  if (!def) {
    throw new HttpError(400, "Transition not allowed", "INVALID_TRANSITION", {
      from,
      to: input.toState,
    });
  }

  if (!roleCanUseTransition(from, input.toState, input.roles)) {
    throw new HttpError(403, "Role cannot perform transition", "FORBIDDEN", {
      from,
      to: input.toState,
    });
  }

  const block = await getTransitionBlockReason({
    orgId: input.orgId,
    transactionId: input.transactionId,
    from,
    to: input.toState,
    userRoles: input.roles,
  });
  if (block) {
    const statusByCode: Record<string, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      INVALID_TRANSITION: 400,
      NO_GOVERNING_AGREEMENT: 409,
      NOOP: 400,
    };
    const status = statusByCode[block.code] ?? 409;
    throw new HttpError(status, block.message, block.code, block.details as object);
  }

  await prisma.$transaction(async (db) => {
    await db.transaction.update({
      where: { id: tx.id },
      data: {
        state: input.toState,
        lifecyclePhase: mapLifecycle(input.toState, tx.lifecyclePhase),
      },
    });
    await db.stateTransitionLog.create({
      data: {
        transactionId: tx.id,
        fromState: from,
        toState: input.toState,
        reason: input.reason,
        actorUserId: input.actorUserId,
        metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  });

  if (input.emitAudit !== false) {
    await recordAudit({
      orgId: input.orgId,
      transactionId: tx.id,
      actorUserId: input.actorUserId,
      eventType: "STATE_TRANSITION",
      action: "STATE_TRANSITION",
      entityType: "Transaction",
      entityId: tx.id,
      resource: "Transaction",
      resourceId: tx.id,
      payload: {
        from,
        to: input.toState,
        reason: input.reason ?? null,
      },
    });
  }

  return { from, to: input.toState };
}

export async function getTransactionStateSnapshot(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  state: TransactionState;
  lifecyclePhase: ContractLifecyclePhase;
  lastTransitions: { toState: TransactionState; at: string; reason: string | null }[];
  selectedLenderProgramId: string | null;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    select: {
      state: true,
      lifecyclePhase: true,
      selectedLenderProgramId: true,
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const logs = await prisma.stateTransitionLog.findMany({
    where: { transactionId: input.transactionId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return {
    state: tx.state,
    lifecyclePhase: tx.lifecyclePhase,
    lastTransitions: logs.map((l) => ({
      toState: l.toState,
      at: l.createdAt.toISOString(),
      reason: l.reason,
    })),
    selectedLenderProgramId: tx.selectedLenderProgramId,
  };
}

export async function getAllowedNextStates(input: {
  orgId: string;
  transactionId: string;
  roles: UserRole[];
}): Promise<
  { to: TransactionState; allowed: boolean; code?: string; message?: string }[]
> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const targets = candidateTargets(tx.state);
  const out: { to: TransactionState; allowed: boolean; code?: string; message?: string }[] =
    [];
  for (const to of targets) {
    const r = await getTransitionBlockReason({
      orgId: input.orgId,
      transactionId: input.transactionId,
      from: tx.state,
      to,
      userRoles: input.roles,
    });
    out.push({
      to,
      allowed: r === null,
      code: r?.code,
      message: r?.message,
    });
  }
  return out.sort((a, b) => a.to.localeCompare(b.to));
}

function mapLifecycle(
  to: TransactionState,
  current: ContractLifecyclePhase,
): ContractLifecyclePhase {
  if (to === "APPROVED" || to === "GREEN_STAGE_1") return "APPROVED";
  if (to === "EXECUTED" || to === "EXECUTED_PENDING_VERIFICATION") return "EXECUTED";
  if (to === "LOCKED") return "LOCKED";
  return current;
}
