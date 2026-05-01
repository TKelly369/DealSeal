/**
 * Projectors maintain **read models** (PostgreSQL, DynamoDB, OpenSearch, etc.).
 * They must never be confused with the system of record — QLDB events are authoritative.
 *
 * Implementations should:
 * - Upsert idempotently on `event.metadata.event_id`
 * - Avoid destructive updates that lose history (append-only projection tables preferred)
 */

import type { CustodyEvent } from "./types.js";

export interface CustodyReadModelProjector {
  /** Apply one event to fast-query stores. */
  project(event: CustodyEvent): Promise<void>;
}

/**
 * Optional: full replay from QLDB export / Kinesis stream for disaster recovery or new projections.
 */
export interface CustodyReplayCapable {
  rebuildFromEventStream(events: AsyncIterable<CustodyEvent>): Promise<void>;
}
