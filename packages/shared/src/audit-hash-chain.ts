import crypto from "node:crypto";

/** Deterministic JSON serialization for tamper-evident audit hashing. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * SOC 2 / ISO-friendly integrity chain: SHA-256(previousChainHash + stableEventJson + ISO timestamp).
 */
export function computeAuditChainHash(params: {
  previousChainHash: string;
  timestampIso: string;
  eventBlob: Record<string, unknown>;
}): string {
  const canonical =
    params.previousChainHash + stableStringify(params.eventBlob) + params.timestampIso;
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}
