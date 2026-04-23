import type { TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { canPatchDealData } from "./hold-service.js";

const CORE_LOCK_STATES = new Set<TransactionState>([
  "EXECUTED",
  "LOCKED",
  "POST_FUNDING_PENDING",
  "COMPLETED",
  "GREEN_STAGE_2",
  "DISCREPANCY_RESTRICTED",
  "HOLD",
  "ARCHIVED",
  "PURGED",
]);

/**
 * Server-side guard for operations that mutate core deal facts (not post-funding rows, not packages).
 */
export async function assertCoreDealDataMutable(params: {
  orgId: string;
  transactionId: string;
}): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: params.transactionId, orgId: params.orgId },
    select: { id: true, state: true },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (CORE_LOCK_STATES.has(tx.state)) {
    throw new HttpError(
      423,
      "Transaction is locked for core data changes",
      "TX_LOCKED",
      { state: tx.state },
    );
  }
}
