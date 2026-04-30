import type { DealParty } from "@/generated/prisma";
import type { DealPartyPiiVault } from "@/lib/types/pii-vault";
import { decryptUtf8 } from "@/lib/crypto/field-encryption";

function maskSsnLike(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `***-**-${digits.slice(-4)}`;
  }
  return "********";
}

function maskBank(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `****${d.slice(-4)}`;
}

export type PiiRevealFlags = {
  revealTaxIdentifier?: boolean;
  revealBank?: boolean;
  revealGovernmentId?: boolean;
};

/**
 * API-safe view of party row: decrypt + mask unless an elevated session explicitly reveals.
 */
export function viewDealPartyPii(
  party: DealParty,
  reveal: PiiRevealFlags,
): {
  taxIdentifierMasked: string | null;
  bankAccountMasked: string | null;
  bankRoutingMasked: string | null;
  governmentIdMasked: string | null;
} {
  const raw = party.encryptedPii as DealPartyPiiVault | null;
  if (!raw?.fields) {
    return {
      taxIdentifierMasked: null,
      bankAccountMasked: null,
      bankRoutingMasked: null,
      governmentIdMasked: null,
    };
  }

  const taxPlain = raw.fields.taxIdentifier ? decryptUtf8(raw.fields.taxIdentifier) : null;
  const bankAccPlain = raw.fields.bankAccount ? decryptUtf8(raw.fields.bankAccount) : null;
  const bankRtPlain = raw.fields.bankRouting ? decryptUtf8(raw.fields.bankRouting) : null;
  const govPlain = raw.fields.governmentId ? decryptUtf8(raw.fields.governmentId) : null;

  return {
    taxIdentifierMasked: taxPlain
      ? reveal.revealTaxIdentifier
        ? taxPlain
        : maskSsnLike(taxPlain)
      : null,
    bankAccountMasked: bankAccPlain
      ? reveal.revealBank
        ? bankAccPlain
        : maskBank(bankAccPlain)
      : null,
    bankRoutingMasked: bankRtPlain
      ? reveal.revealBank
        ? bankRtPlain
        : maskBank(bankRtPlain)
      : null,
    governmentIdMasked: govPlain
      ? reveal.revealGovernmentId
        ? govPlain
        : maskSsnLike(govPlain)
      : null,
  };
}
