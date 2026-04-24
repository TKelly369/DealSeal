import type { Env } from "./env.js";

/**
 * Public base URL for QR codes and user-facing verification links.
 * Per product rules: use VERIFICATION_PUBLIC_BASE_URL, then APP_PUBLIC_URL, then local dev default.
 */
export function getVerificationPublicBaseUrl(
  env: Pick<Env, "VERIFICATION_PUBLIC_BASE_URL" | "APP_PUBLIC_URL">,
  opts?: { devDefault?: string },
): string {
  const fallback = opts?.devDefault ?? "http://localhost:3000";
  const raw = env.VERIFICATION_PUBLIC_BASE_URL?.trim() || env.APP_PUBLIC_URL?.trim() || fallback;
  return raw.replace(/\/$/, "");
}

/**
 * Full public URL of the **human verification page** (Next.js), for QR codes — not the raw API.
 */
export function buildPublicVerifyPageUrl(
  env: Pick<Env, "VERIFICATION_PUBLIC_BASE_URL" | "APP_PUBLIC_URL">,
  governingRecordId: string,
  opts?: { devDefault?: string },
): string {
  const base = getVerificationPublicBaseUrl(env, opts);
  return `${base}/verify/${governingRecordId}`;
}
