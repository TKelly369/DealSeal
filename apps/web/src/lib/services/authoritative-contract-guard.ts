import type { AuthoritativeContract, Deal, DealStatus } from "@/generated/prisma";

/** Deal stages where the authoritative record must not be regenerated without an Amendment. */
const POST_LOCK_DEAL_STATUSES: DealStatus[] = [
  "AUTHORITATIVE_LOCK",
  "GENERATING_CLOSING_PACKAGE",
  "CLOSING_PACKAGE_READY",
  "CONSUMMATED",
];

const LOCKED_SIGNATURE_STATUSES = new Set([
  "SIGNED",
  "LOCKED",
  "EXECUTED_RISC",
  "EXECUTED_RISC_AMENDED",
  "PURGED_AFTER_RETENTION",
]);

export function isAuthoritativeContractFrozen(deal: Deal, contract: AuthoritativeContract | null): boolean {
  if (!contract) return false;
  if (LOCKED_SIGNATURE_STATUSES.has(contract.signatureStatus)) return true;
  if (POST_LOCK_DEAL_STATUSES.includes(deal.status)) return true;
  return false;
}

/** Throws if the canonical contract row cannot be rewritten in place (requires Amendment + version bump). */
export function assertAuthoritativeContractMutableOrThrow(deal: Deal, contract: AuthoritativeContract | null): void {
  if (isAuthoritativeContractFrozen(deal, contract)) {
    throw new Error(
      "AUTHORITATIVE_CONTRACT_LOCKED: AuthoritativeContract is frozen after sign/fund stages. Open a formal Amendment to increment version and issue a new hash.",
    );
  }
}
