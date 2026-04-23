import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";
import { transitionTransaction } from "./state-engine.js";
import type { TransactionState, UserRole } from "@prisma/client";
import { ExecutedContractVerificationState } from "@prisma/client";

export async function getLockStatus(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  state: TransactionState;
  governingLockedAt: string | null;
  sourceInstrument: {
    executedContractId: string | null;
    documentVersionId: string | null;
    sha256: string | null;
    lockedAt: string | null;
  };
  hasActiveEmbodiment: boolean;
  coreEditsAllowed: boolean;
  reason: string;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { governingAgreement: true, authoritativeEmbodiments: { where: { active: true } } },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const ec = await prisma.executedContract.findFirst({
    where: { transactionId: tx.id, authoritative: true },
    include: { documentVersion: true },
    orderBy: { createdAt: "desc" },
  });
  const coreLocked =
    tx.state !== "DRAFT" &&
    tx.state !== "RED" &&
    tx.state !== "INVALID" &&
    tx.state !== "YELLOW" &&
    tx.state !== "CONDITIONAL" &&
    tx.state !== "GREEN_STAGE_1";
  return {
    state: tx.state,
    governingLockedAt: tx.governingAgreement?.lockedAt?.toISOString() ?? null,
    sourceInstrument: {
      executedContractId: ec?.id ?? null,
      documentVersionId: ec?.documentVersionId ?? null,
      sha256: ec?.documentVersion?.sha256 ?? ec?.sha256 ?? null,
      lockedAt: ec?.lockedAt?.toISOString() ?? null,
    },
    hasActiveEmbodiment: tx.authoritativeEmbodiments.length > 0,
    coreEditsAllowed: !coreLocked,
    reason: coreLocked
      ? "Core deal fields are read-only in this state."
      : "Core deal fields can be edited subject to other checks.",
  };
}

/**
 * Seals the governing agreement row, marks document version immutable, and transitions to LOCKED.
 */
export async function applyTransactionLock(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  roles: UserRole[];
}): Promise<{ to: TransactionState }> {
  const tr = await transitionTransaction({
    orgId: input.orgId,
    transactionId: input.transactionId,
    toState: "LOCKED",
    actorUserId: input.actorUserId,
    roles: input.roles,
    reason: "lock activated after verified execution",
    metadata: { kind: "AUTHORITY_LOCK" },
  });
  return { to: tr.to };
}

export async function activateLockSideEffects(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
}): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { governingAgreement: true },
  });
  if (!tx || !tx.governingAgreement) return;

  const accepted = await prisma.executedContract.findFirst({
    where: {
      transactionId: tx.id,
      verificationStatus: ExecutedContractVerificationState.VERIFIED,
    },
    include: { documentVersion: true },
  });
  if (!accepted) return;

  const now = new Date();
  await prisma.$transaction(async (db) => {
    await db.governingAgreement.update({
      where: { id: tx.governingAgreement!.id },
      data: {
        lockedAt: now,
        executedVersion: tx.governingAgreement!.candidateVersion,
      },
    });
    if (accepted.documentVersionId) {
      await db.documentVersion.update({
        where: { id: accepted.documentVersionId },
        data: { isImmutable: true, authoritative: true },
      });
    }
    await db.executedContract.update({
      where: { id: accepted.id },
      data: { lockedAt: now },
    });
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "LOCK_ARTIFACTS",
    action: "LOCK_ARTIFACTS",
    entityType: "GoverningAgreement",
    entityId: tx.governingAgreement.id,
    resource: "GoverningAgreement",
    resourceId: tx.governingAgreement.id,
    payload: { executedContractId: accepted.id, documentVersionId: accepted.documentVersionId },
  });
}
