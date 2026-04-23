export const TransactionStates = [
  "DRAFT",
  "RED",
  "INVALID",
  "YELLOW",
  "CONDITIONAL",
  "GREEN_STAGE_1",
  "APPROVED",
  "EXECUTED",
  "EXECUTED_PENDING_VERIFICATION",
  "LOCKED",
  "POST_FUNDING_PENDING",
  "COMPLETED",
  "GREEN_STAGE_2",
  "DISCREPANCY_RESTRICTED",
  "HOLD",
  "ARCHIVED",
  "PURGED",
] as const;

export type TransactionState = (typeof TransactionStates)[number];

/** Canonical progression for seal sequence (approval → execution → upload → validation → lock). */
export const SealSequence = [
  "GREEN_STAGE_1",
  "APPROVED",
  "EXECUTED_PENDING_VERIFICATION",
  "EXECUTED",
  "LOCKED",
] as const satisfies readonly TransactionState[];
