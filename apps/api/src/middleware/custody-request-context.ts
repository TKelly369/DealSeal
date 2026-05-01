import type { Request } from "express";
import type { CustodyRequestContext } from "@dealseal/custody-ledger";

/** Optional client device binding signal (never trusted for auth; evidence only). */
export const DEVICE_FINGERPRINT_HEADER = "x-dealseal-device-fingerprint";

function forwardedClientIp(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0]?.trim();
  }
  if (Array.isArray(xff) && xff[0]?.trim()) {
    return xff[0].split(",")[0]?.trim();
  }
  return undefined;
}

/**
 * Extracts Zero-Trust transport context. JWT `user_id` / `role` belong in the Command’s
 * `issuedBy` field (server-side after `verify`); this helper covers network/device signals only.
 */
export function buildCustodyRequestContext(req: Request): CustodyRequestContext {
  const ip =
    forwardedClientIp(req) ??
    (typeof req.ip === "string" ? req.ip : undefined) ??
    req.socket.remoteAddress ??
    "unknown";

  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";

  const fpRaw = req.headers[DEVICE_FINGERPRINT_HEADER];
  const device_fingerprint =
    typeof fpRaw === "string" && fpRaw.trim() ? fpRaw.trim() : "none-reported";

  return {
    ip_address: ip,
    user_agent: ua,
    device_fingerprint,
  };
}
