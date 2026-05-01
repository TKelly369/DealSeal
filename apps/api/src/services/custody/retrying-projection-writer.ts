import type {
  CustodyEvent,
  CustodyLedgerCommitHint,
  CustodyProjectionWriter,
} from "@dealseal/custody-ledger";
import { logger } from "../../lib/logger.js";

export class RetryingCustodyProjectionWriter implements CustodyProjectionWriter {
  constructor(
    private readonly inner: CustodyProjectionWriter,
    private readonly opts: { maxAttempts?: number; baseDelayMs?: number } = {},
  ) {}

  async applyCustodyEvent(event: CustodyEvent, ledgerHint?: CustodyLedgerCommitHint): Promise<void> {
    const maxAttempts = this.opts.maxAttempts ?? 5;
    let delayMs = this.opts.baseDelayMs ?? 200;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.inner.applyCustodyEvent(event, ledgerHint);
        return;
      } catch (err) {
        lastErr = err;
        logger.warn("custody_projection_attempt_failed", {
          attempt,
          maxAttempts,
          eventId: event.metadata.event_id,
          dealId: event.metadata.deal_id,
          err: String(err),
        });
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs = Math.min(delayMs * 2, 10_000);
        }
      }
    }

    logger.error("custody_projection_exhausted", {
      eventId: event.metadata.event_id,
      dealId: event.metadata.deal_id,
      err: String(lastErr),
      reconciliation: "QLDB_APPEND_OK_RECONCILE_PROJECTION",
    });
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
