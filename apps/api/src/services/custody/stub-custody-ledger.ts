import type { AppendEventResult, CustodyEvent, CustodyLedgerPort } from "@dealseal/custody-ledger";

/**
 * Local / CI ledger port when `DEALSEAL_QLDB_LEDGER_NAME` is unset. Does not call AWS.
 * Evidence is still written to Postgres projections; replay from QLDB is not available for these rows.
 */
export class StubCustodyLedger implements CustodyLedgerPort {
  async appendEvent(event: CustodyEvent): Promise<AppendEventResult> {
    return {
      documentId: `stub:${event.metadata.event_id}`,
      digestTipBase64: "",
    };
  }
}
