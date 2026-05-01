/**
 * DealSeal Immutable Custody Ledger — core domain types.
 *
 * Regulatory context (high level): immutable, append-only custody supports
 * defensible audit for SEC 17a-4-style recordkeeping, FINRA books & records
 * expectations, and SOX ITGC evidence — implemented here as event sourcing
 * with an external cryptographic ledger (Amazon QLDB) plus RFC 3161 timestamps.
 *
 * We never model "mutable rows" for custody truth: the event stream is truth;
 * relational DB rows are projections only.
 */

/** Cryptographic hash of canonical event bytes (SHA-256 hex, lowercase). */
export type Sha256Hex = string;

/** Opaque QLDB document id / revision identifier returned after append. */
export type QldbDocumentId = string;

/** Tip-of-ledger metadata after a successful QLDB append (for projections / reconciliation). */
export interface CustodyLedgerCommitHint {
  documentId: string;
  digestTipBase64: string;
}

/**
 * Zero-trust metadata: every custody event must carry non-repudiation context.
 * Client-supplied timestamps are intentionally NOT trusted; server generates
 * `receivedAt` and TSA attests logical ordering.
 */
export interface ZeroTrustMetadata {
  /** Stable unique id for this event (UUID v4 recommended). */
  event_id: string;
  /** Deal / file correlation id (DealSeal deal or external loan id). */
  deal_id: string;
  /** Domain event name, e.g. DealSubmitted, LenderViewedDocument. */
  event_type: CustodyEventType;
  /**
   * Server-side receipt time (ISO 8601). Never copy from client clocks for evidence.
   */
  timestamp: string;
  /** Authenticated subject; null only for system actors. */
  user_id: string | null;
  /** DealSeal role or external IAM role string. */
  role: string;
  ip_address: string;
  /** Device binding signal (hashed client fingerprint or attested device id). */
  device_fingerprint: string;
  user_agent: string;
  /** Content hash of referenced blob, if any (SHA-256 hex). */
  document_hash: Sha256Hex | null;
  /**
   * RFC 3161 time-stamp token (Base64 DER), from a trusted TSA after hashing payload.
   * Proves payload existed at TSA time independent of server clock.
   */
  tsa_token: string;
  /**
   * SHA-256 over canonical payload bytes that were sent to the TSA (hex).
   * Allows auditors to re-verify TSA response without replaying full event JSON.
   */
  tsa_payload_hash: Sha256Hex;
}

/**
 * Auto-fintech–specific custody event vocabulary. Extend as product grows.
 * Names are past-tense facts suitable for an append-only log.
 */
export type CustodyEventType =
  | "DealCreated"
  | "StipulationUploaded"
  | "ContractEsigned"
  | "DealFunded"
  | "DealSubmitted"
  | "StipUploaded"
  | "LenderViewed"
  | "LenderDownloaded"
  | "ESignatureCompleted"
  | "AuditLogExported"
  | "DocumentCustodySealed"
  | "ComplianceCheckRecorded"
  | "FundingPackageGenerated"
  | "SecondaryMarketTransferRecorded";

/**
 * Immutable custody event: the unit appended to QLDB. No updates — new event supersedes
 * interpretation via projections only.
 */
export interface CustodyEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  /** Schema version for migration of projection replay. */
  schemaVersion: 1;
  metadata: ZeroTrustMetadata;
  /** Domain payload (PII must be minimized; prefer references + hashes). */
  payload: TPayload;
}

/**
 * Command: intent to change system state. Commands may be rejected; successful
 * handling always produces exactly one (or zero, if idempotent no-op) Event.
 */
export interface Command<TName extends string = string, TBody extends Record<string, unknown> = Record<string, unknown>> {
  commandId: string;
  commandType: TName;
  deal_id: string;
  /** Expected aggregate version for optimistic concurrency (optional). */
  expectedVersion?: number;
  body: TBody;
  /** Who issued the command (after authn). */
  issuedBy: { user_id: string; role: string };
}

export type DealCreatedCommand = Command<
  "DealCreated",
  {
    deal_type: string;
    lender_id: string;
  }
>;

export type StipulationUploadedCommand = Command<
  "StipulationUploaded",
  {
    document_name: string;
    mime_type: string;
    content_sha256_hash: Sha256Hex;
  }
>;

export type ContractEsignedCommand = Command<
  "ContractEsigned",
  {
    signer_role: string;
    signature_provider_tx_id: string;
  }
>;

export type DealFundedCommand = Command<
  "DealFunded",
  {
    funding_amount_cents: number;
  }
>;

/**
 * Deal aggregate: fold of events. Used for validation before append.
 * This is the in-memory / projected legal boundary for "what is allowed next".
 */
export interface DealAggregate {
  deal_id: string;
  /** Monotonic version = number of applied custody events. */
  version: number;
  /** Latest snapshot of lifecycle for quick checks. */
  lifecyclePhase: "intake" | "underwriting" | "funding" | "closed" | "sold" | "archived";
  /** Last known governing document hash, if any. */
  governingDocumentHash: Sha256Hex | null;
  /** Open compliance blockers (derived; not stored as mutable row in ledger). */
  openBlockers: string[];
}

/**
 * Read-model projector: applies one event to PostgreSQL/DynamoDB/etc.
 * Implementations MUST be idempotent on (event_id) to allow safe replay.
 */
export interface CustodyProjectionWriter {
  applyCustodyEvent(event: CustodyEvent, ledgerHint?: CustodyLedgerCommitHint): Promise<void>;
}

/**
 * Loads current aggregate (from projection) for command validation.
 */
export interface DealAggregateLoader {
  loadByDealId(dealId: string): Promise<DealAggregate | null>;
}

/** HTTP / edge context for zero-trust fields. */
export interface CustodyRequestContext {
  ip_address: string;
  user_agent: string;
  device_fingerprint: string;
}
