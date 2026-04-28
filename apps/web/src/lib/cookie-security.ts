/**
 * Whether auth-related cookies should use the Secure flag.
 * - Prefer explicit https in AUTH_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL.
 * - Vercel sets VERCEL_URL (host only); treat as https on that platform.
 * - Plain http://localhost / 127.0.0.1 → false so `next start` on http still works.
 */
export function secureSessionCookies(): boolean {
  if (process.env.DEALSEAL_FORCE_SECURE_COOKIES === "true") return true;
  if (process.env.DEALSEAL_FORCE_INSECURE_COOKIES === "true") return false;

  const candidates = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter((v): v is string => Boolean(v && v.length > 0));

  for (const raw of candidates) {
    const u = raw.trim().toLowerCase();
    if (u.startsWith("https://")) return true;
    if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) return false;
    if (u.startsWith("http://")) return false;
  }

  return false;
}
