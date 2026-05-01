/**
 * Deal aggregate: validates commands against projected state.
 *
 * Full event-sourcing replay would fold List<CustodyEvent> → DealAggregate.
 * For operational latency, DealSeal may hydrate from a projection table, then
 * optionally verify by replaying from QLDB on dispute — both patterns are valid;
 * QLDB remains the evidence store.
 */

import type { Command, CustodyEvent, CustodyEventType, DealAggregate } from "./types.js";

export const INITIAL_DEAL_AGGREGATE = (dealId: string): DealAggregate => ({
  deal_id: dealId,
  version: 0,
  lifecyclePhase: "intake",
  governingDocumentHash: null,
  openBlockers: [],
});

/**
 * Pure fold: apply one event to aggregate (used in replay / tests).
 */
export function foldEvent(agg: DealAggregate, event: CustodyEvent): DealAggregate {
  const next: DealAggregate = {
    ...agg,
    version: agg.version + 1,
  };
  switch (event.metadata.event_type) {
    case "DealCreated":
    case "DealSubmitted":
      return { ...next, lifecyclePhase: "underwriting" };
    case "DealFunded":
      return { ...next, lifecyclePhase: "closed" };
    case "FundingPackageGenerated":
      return { ...next, lifecyclePhase: "funding" };
    case "SecondaryMarketTransferRecorded":
      return { ...next, lifecyclePhase: "sold" };
    case "DocumentCustodySealed":
      return {
        ...next,
        governingDocumentHash: (event.payload as { documentHash?: string }).documentHash ?? agg.governingDocumentHash,
      };
    case "ComplianceCheckRecorded":
      if ((event.payload as { status?: string }).status === "BLOCKED") {
        return {
          ...next,
          openBlockers: [...agg.openBlockers, String((event.payload as { checkKey?: string }).checkKey ?? "unknown")],
        };
      }
      return next;
    default:
      return next;
  }
}

export class AggregateValidator {
  validate(
    aggregate: DealAggregate,
    command: Command,
    _eventTypeToEmit: CustodyEventType,
  ): void {
    if (command.deal_id !== aggregate.deal_id) {
      throw new Error("COMMAND_DEAL_MISMATCH: command targets wrong aggregate.");
    }
    if (command.expectedVersion !== undefined && command.expectedVersion !== aggregate.version) {
      throw new Error(
        `COMMAND_VERSION_CONFLICT: expected ${command.expectedVersion}, aggregate at ${aggregate.version}.`,
      );
    }
    // Example rule: cannot export audit until deal has left pure intake
    if (command.commandType === "RequestAuditExport" && aggregate.version === 0) {
      throw new Error("COMMAND_REJECTED: no custody events to export.");
    }
  }
}
