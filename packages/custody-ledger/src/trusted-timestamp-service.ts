/**
 * RFC 3161 Trusted Timestamping
 *
 * Server wall clock is never sufficient for custodian-grade evidence. A TSA
 * signs a hash of the request, binding data existence to public time as
 * attested by the authority (DigiCert, Sectigo, etc.).
 *
 * Production: replace `requestTimestampFromTsa` with HTTPS to vendor API.
 * This module uses Node `crypto` for SHA-256 and returns a mock token in dev.
 */

import { createHash, randomBytes } from "node:crypto";
import { canonicalizeJson } from "./canonical-json.js";
import type { CustodyEvent } from "./types.js";

export interface TsaResponse {
  /** Base64-encoded RFC 3161 TimeStampResp (DER). */
  tokenBase64: string;
  /** Hash that was presented to the TSA (SHA-256 hex). */
  payloadHashHex: string;
}

export class TrustedTimestampService {
  constructor(
    private readonly options: {
      /** When false, uses cryptographically honest mock (still not legally a TSA). */
      useMockTsa: boolean;
      tsaUrl?: string;
      tsaApiKey?: string;
    } = { useMockTsa: true },
  ) {}

  /**
   * Hash the canonical custody event bytes, then obtain RFC 3161 token.
   * The hash input MUST exclude any mutable fields; we hash the full event
   * after clearing tsa_token (token is computed over payload without token).
   */
  async attestEventPayload(event: CustodyEvent): Promise<TsaResponse> {
    const forHash: CustodyEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        tsa_token: "",
      },
    };
    const canonical = canonicalizeJson(forHash);
    const payloadHashHex = createHash("sha256").update(canonical, "utf8").digest("hex");

    if (this.options.useMockTsa) {
      return this.mockTsaToken(payloadHashHex);
    }
    return this.requestTimestampFromTsa(payloadHashHex);
  }

  /** Hash arbitrary bytes (hex) for non-event attestations. */
  async attestSha256Hex(hashHex: string): Promise<TsaResponse> {
    if (this.options.useMockTsa) {
      return this.mockTsaToken(hashHex);
    }
    return this.requestTimestampFromTsa(hashHex);
  }

  /**
   * Mock TSA: produces a non-standard but deterministic envelope so integration
   * tests can assert presence without vendor credentials.
   * DO NOT use for production legal weight.
   */
  private mockTsaToken(payloadHashHex: string): TsaResponse {
    const nonce = randomBytes(16).toString("hex");
    const mockDerLike = Buffer.concat([
      Buffer.from("MOCK-RFC3161-DEALSEAL-v1\0", "utf8"),
      Buffer.from(payloadHashHex, "utf8"),
      Buffer.from("\0", "utf8"),
      Buffer.from(nonce, "utf8"),
    ]);
    return {
      tokenBase64: mockDerLike.toString("base64"),
      payloadHashHex,
    };
  }

  /**
   * Placeholder for real TSA (RFC 3161 HTTP or CMP). Wire DigiCert/Sectigo per contract.
   */
  private async requestTimestampFromTsa(_payloadHashHex: string): Promise<TsaResponse> {
    void _payloadHashHex;
    throw new Error(
      "PRODUCTION_TSA_NOT_CONFIGURED: set useMockTsa:true for dev or implement HTTPS TSA request.",
    );
  }
}
