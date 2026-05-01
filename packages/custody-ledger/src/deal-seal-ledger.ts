/**
 * Amazon QLDB — append-only custody ledger
 *
 * QLDB provides an immutable journal + Merkle tree digest per revision.
 * Application code must NEVER issue UPDATE or DELETE for evidence tables;
 * corrections are new events (e.g. CorrectionRecorded) in the same stream.
 *
 * PartiQL INSERT appends documents. We use the official Node driver, which is
 * built on AWS SDK for JavaScript v3 and handles transaction commit hashing (Ion).
 *
 * Prerequisites:
 *   - Ledger created in AWS (e.g. `aws qldb create-ledger --name DealSealCustody`)
 *   - Table: `CREATE TABLE CustodyEvents` (run once via QLDB shell / PartiQL)
 *
 * @see https://docs.aws.amazon.com/qldb/latest/developerguide/driver-node.html
 */

/**
 * NOTE (2024+): AWS marked the JavaScript QLDB control-plane clients as deprecated in favor of
 * long-term support models. Ledger APIs remain usable where deployed; plan migration if AWS
 * announces end-of-life. This module encodes the architecture you specified.
 */
import { QLDBClient, GetDigestCommand } from "@aws-sdk/client-qldb";
import { QldbDriver } from "amazon-qldb-driver-nodejs";
import type { CustodyEvent } from "./types.js";

export interface AppendEventResult {
  /** QLDB document identifier for this revision (for GetRevision proofs). */
  documentId: string;
  /** Journal tip digest (Base64) at time of commit — store with projection for later verify. */
  digestTipBase64: string;
}

/** Application port: swap QLDB for an in-memory stub in local dev without AWS. */
export interface CustodyLedgerPort {
  appendEvent(event: CustodyEvent): Promise<AppendEventResult>;
}

export class DealSealLedger implements CustodyLedgerPort {
  private readonly qldbControl: QLDBClient;
  private readonly driver: QldbDriver;

  constructor(
    private readonly ledgerName: string,
    region: string = process.env.AWS_REGION ?? "us-east-1",
  ) {
    this.qldbControl = new QLDBClient({ region });
    /**
     * QldbDriver manages pooled sessions, StartTransaction / Commit, and Ion hash chain
     * required by QLDB — this is the supported way to execute PartiQL with SDK v3.
     */
    this.driver = new QldbDriver(this.ledgerName, {
      region,
    });
  }

  /**
   * Append a single custody event document. Only INSERT — never UPDATE/DELETE.
   */
  async appendEvent(event: CustodyEvent): Promise<AppendEventResult> {
    let documentId = "";
    await this.driver.executeLambda(async (txn) => {
      /**
       * PartiQL parameterized INSERT: `?` binds to Ion struct from plain object.
       * One row = one immutable custody fact.
       */
      const result = await txn.execute("INSERT INTO CustodyEvents ?", event);
      const row = result.getResultList()[0] as { get?: (k: string) => { stringValue?: () => string } | undefined } | undefined;
      const docField = row?.get?.("documentId");
      const docId = docField?.stringValue?.();
      if (docId) documentId = docId;
    });

    const digest = await this.fetchJournalDigest();

    return {
      documentId: documentId || "unknown",
      digestTipBase64: digest.digestBase64,
    };
  }

  /**
   * Returns the current 256-bit journal digest at the tip of the Merkle tree.
   * Auditors compare this value across time to detect journal tampering.
   */
  async fetchJournalDigest(): Promise<{ digest: Uint8Array; digestBase64: string; tipAddress: string }> {
    const out = await this.qldbControl.send(
      new GetDigestCommand({ Name: this.ledgerName }),
    );
    const digest = out.Digest;
    if (!digest) {
      throw new Error("QLDB_GET_DIGEST_EMPTY: ledger may not exist or IAM denied.");
    }
    const tip = out.DigestTipAddress;
    const tipStr = tip?.IonText ?? JSON.stringify(tip ?? {});
    return {
      digest,
      digestBase64: Buffer.from(digest).toString("base64"),
      tipAddress: tipStr,
    };
  }

  /**
   * Chain-head integrity: prove the live journal digest matches a snapshot taken at seal time.
   * For per-event Merkle inclusion without exporting the database, use `GetRevision` + proof
   * verification against this digest (see AWS QLDB documentation).
   */
  async verifyDigest(expectedDigestBase64: string): Promise<boolean> {
    return this.verifyDigestMatchesTip(expectedDigestBase64);
  }

  async verifyDigestMatchesTip(expectedDigestBase64: string): Promise<boolean> {
    const live = await this.fetchJournalDigest();
    const a = Buffer.from(expectedDigestBase64, "base64");
    const b = Buffer.from(live.digestBase64, "base64");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Compare two digest byte arrays in constant time (mitigates timing probes).
   */
  verifyDigestBytesConstantTime(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

function timingSafeEqual(x: Buffer, y: Buffer): boolean {
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

/** Snapshot of the journal tip digest bytes returned by `GetDigest`. */
export type LedgerDigestSnapshot = Uint8Array;
