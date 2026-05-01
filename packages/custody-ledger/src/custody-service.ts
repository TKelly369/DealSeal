/**
 * CustodyService — orchestrates the regulated data flow:
 *
 *   Command → validate (aggregate) → Event → SHA-256 canonical payload → TSA (RFC 3161)
 *   → append Amazon QLDB (immutable) → projection update (PostgreSQL / Dynamo “read model”).
 *
 * No UPDATE/DELETE on the ledger path. Projection writers must upsert by `event_id` for idempotency.
 */

import { randomUUID } from "node:crypto";
import { AggregateValidator } from "./aggregate.js";
import type { CustodyLedgerPort } from "./deal-seal-ledger.js";
import type {
  Command,
  CustodyEvent,
  CustodyEventType,
  CustodyProjectionWriter,
  CustodyRequestContext,
  DealAggregate,
  DealAggregateLoader,
} from "./types.js";
import type { TrustedTimestampService } from "./trusted-timestamp-service.js";

/**
 * Maps an authorized command to a fully-formed event (before TSA + QLDB).
 * This is where auto-fintech semantics live (e.g. StipUploaded vs LenderViewed).
 */
export interface CustodyCommandInterpreter {
  interpret(command: Command, aggregateVersion: number): {
    event_type: CustodyEventType;
    payload: Record<string, unknown>;
    document_hash: string | null;
  };
}

export class CustodyService {
  private readonly validator = new AggregateValidator();

  constructor(
    private readonly ledger: CustodyLedgerPort,
    private readonly tsa: TrustedTimestampService,
    private readonly projection: CustodyProjectionWriter,
    private readonly aggregates: DealAggregateLoader,
    private readonly interpreter: CustodyCommandInterpreter,
  ) {}

  /**
   * End-to-end handling of a validated command from the application layer.
   */
  async handleCommand(command: Command, ctx: CustodyRequestContext): Promise<{
    event: CustodyEvent;
    ledger: { documentId: string; digestTipBase64: string };
    projection: { ok: true } | { ok: false; errorMessage: string };
  }> {
    const aggregate: DealAggregate =
      (await this.aggregates.loadByDealId(command.deal_id)) ??
      ({
        deal_id: command.deal_id,
        version: 0,
        lifecyclePhase: "intake",
        governingDocumentHash: null,
        openBlockers: [],
      } as DealAggregate);

    const { event_type, payload, document_hash } = this.interpreter.interpret(command, aggregate.version);
    this.validator.validate(aggregate, command, event_type);

    const event_id = randomUUID();
    const timestamp = new Date().toISOString();

    const draftEvent: CustodyEvent = {
      schemaVersion: 1,
      metadata: {
        event_id,
        deal_id: command.deal_id,
        event_type,
        timestamp,
        user_id: command.issuedBy.user_id,
        role: command.issuedBy.role,
        ip_address: ctx.ip_address,
        device_fingerprint: ctx.device_fingerprint,
        user_agent: ctx.user_agent,
        document_hash,
        tsa_token: "",
        tsa_payload_hash: "",
      },
      payload,
    };

    const tsaOut = await this.tsa.attestEventPayload(draftEvent);
    const event: CustodyEvent = {
      ...draftEvent,
      metadata: {
        ...draftEvent.metadata,
        tsa_token: tsaOut.tokenBase64,
        tsa_payload_hash: tsaOut.payloadHashHex,
      },
    };

    const ledgerResult = await this.ledger.appendEvent(event);
    try {
      await this.projection.applyCustodyEvent(event, ledgerResult);
      return { event, ledger: ledgerResult, projection: { ok: true } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { event, ledger: ledgerResult, projection: { ok: false, errorMessage } };
    }
  }

  /**
   * Record a pre-built event (e.g. system actor) — still runs TSA + QLDB + projection.
   */
  async recordSystemEvent(
    event: Omit<CustodyEvent, "metadata"> & {
      metadata: Omit<CustodyEvent["metadata"], "tsa_token" | "tsa_payload_hash" | "timestamp"> & {
        timestamp?: string;
      };
    },
  ): Promise<{
    ledger: { documentId: string; digestTipBase64: string };
    projection: { ok: true } | { ok: false; errorMessage: string };
  }> {
    const timestamp = event.metadata.timestamp ?? new Date().toISOString();
    const draft: CustodyEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        timestamp,
        tsa_token: "",
        tsa_payload_hash: "",
      },
    };
    const tsaOut = await this.tsa.attestEventPayload(draft);
    const finalEvent: CustodyEvent = {
      ...draft,
      metadata: {
        ...draft.metadata,
        tsa_token: tsaOut.tokenBase64,
        tsa_payload_hash: tsaOut.payloadHashHex,
      },
    };
    const ledgerResult = await this.ledger.appendEvent(finalEvent);
    try {
      await this.projection.applyCustodyEvent(finalEvent, ledgerResult);
      return { ledger: ledgerResult, projection: { ok: true } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { ledger: ledgerResult, projection: { ok: false, errorMessage } };
    }
  }
}
