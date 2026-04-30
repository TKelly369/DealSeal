/**
 * Dealer “first lock”: after onboarding, opening disclosure must be on file before deal workflows.
 * Allowed beforehand: profile/setup, names, locations, dashboard shell — not deals, lenders, etc.
 */

/** Deal capabilities blocked until workspace opening disclosure is uploaded (UI + routing). */
export const DEALER_DISCLOSURE_BLOCKED_CAPABILITIES = [
  "Add buyer details",
  "Add vehicle details",
  "Build numbers",
  "Generate contracts",
  "Upload full deal documents",
  "Submit to lender",
] as const;

const ALLOWED_EXACT = new Set([
  "/dealer",
  "/dealer/dashboard",
  "/dealer/disclosure-gate",
  "/dealer/onboarding",
  "/dealer/settings",
]);

/** @returns true when path may load without opening disclosure filed. */
export function isDealerPathAllowedBeforeOpeningDisclosure(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  if (ALLOWED_EXACT.has(p)) return true;
  if (p.startsWith("/dealer/onboarding/")) return true;
  return false;
}
