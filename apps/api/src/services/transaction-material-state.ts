import type { Prisma, TransactionState } from "@prisma/client";

/**
 * After a MATERIAL structural change, demote workflow state so re-validation is required.
 * APPROVED → CONDITIONAL; CONDITIONAL → DRAFT. Does not demote EXECUTED+ (blocked earlier).
 */
export async function applyMaterialStateDemotion(
  db: Prisma.TransactionClient,
  input: {
    transactionId: string;
    fromState: TransactionState;
    actorUserId: string;
    reason: string;
  },
): Promise<TransactionState | null> {
  const { transactionId, fromState, actorUserId, reason } = input;
  let toState: TransactionState | null = null;
  if (fromState === "GREEN_STAGE_1" || fromState === "APPROVED") toState = "YELLOW";
  else if (fromState === "YELLOW" || fromState === "CONDITIONAL") toState = "DRAFT";
  else return null;

  await db.transaction.update({
    where: { id: transactionId },
    data: { state: toState },
  });
  await db.stateTransitionLog.create({
    data: {
      transactionId,
      fromState,
      toState,
      reason,
      actorUserId,
      metadataJson: { kind: "MATERIAL_DATA_DEMOTION" },
    },
  });
  return toState;
}
