import type { TransactionState } from "@prisma/client";
import { rebuildCompletionProtocol } from "./completion-protocol.js";
import { recordUsage } from "./pricing-engine.js";
import { prisma } from "../lib/prisma.js";
import { activateLockSideEffects } from "./lock-activation-service.js";

/**
 * Post-transition billing + completion side-effects (sealed deal metering, task rebuild).
 */
export async function onDealStateSettled(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  toState: TransactionState;
}): Promise<void> {
  if (input.toState === "LOCKED") {
    await activateLockSideEffects({
      orgId: input.orgId,
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
    });
    await rebuildCompletionProtocol({
      orgId: input.orgId,
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
    });
    await recordUsage(prisma, {
      orgId: input.orgId,
      transactionId: input.transactionId,
      eventType: "DEAL_SEALED",
      quantity: 1,
      idempotencyKey: `seal:${input.transactionId}`,
    });
  }
}
