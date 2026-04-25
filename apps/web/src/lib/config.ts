/**
 * Server-only and public URL config for the Next.js app.
 * - NEXT_PUBLIC_*: exposed to the browser (only what you prefix).
 * - API_INTERNAL_URL: optional; use when the server must call the API on a private URL (e.g. Docker service name) while
 *   VERIFICATION_PUBLIC_BASE_URL is the public web origin for QR links (configured on the API, not here).
 */
export function getServerApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/$/, "");
}

export function getPublicApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/$/, "");
}

export function getPublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}
