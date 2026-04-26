import type { StateRequirementSet, SupportedState } from "@/lib/ai/types";

export const STATE_REQUIREMENTS: Record<SupportedState, StateRequirementSet> = {
  CA: {
    state: "CA",
    governingLawReferences: [
      "California Vehicle Code financing and disclosure framework",
      "California consumer credit and retail installment requirements",
    ],
    requiredDisclosures: [
      "California financing itemization disclosure",
      "State-required arbitration and consumer notice disclosure",
    ],
    requiredPackageDocuments: [
      "Retail Installment Sales Contract",
      "California State Disclosure Addendum",
      "Privacy and Data Use Notice",
      "Electronic Signature Consent Record",
      "Chain-of-Custody Certification Summary",
    ],
    wetInkRequiredDocuments: ["Power of Attorney (if title transfer delegated)"],
    prohibitedClauses: ["Confession of judgment", "Blanket non-curable default language"],
    titlePerfectionRules: [
      "Lien filing required within prescribed DMV timeline",
      "Authoritative record must preserve assignment chain metadata",
    ],
  },
  TX: {
    state: "TX",
    governingLawReferences: [
      "Texas Finance Code motor vehicle installment framework",
      "Texas consumer protection notice and remedy requirements",
    ],
    requiredDisclosures: [
      "Texas finance charge and total of payments disclosure",
      "Insurance and optional product election disclosures",
    ],
    requiredPackageDocuments: [
      "Retail Installment Contract",
      "Texas Contract Disclosure Addendum",
      "Privacy and Data Use Notice",
      "Electronic Signature Consent Record",
      "Chain-of-Custody Certification Summary",
    ],
    wetInkRequiredDocuments: [],
    prohibitedClauses: ["Unauthorized waiver of statutory consumer rights"],
    titlePerfectionRules: [
      "Lien notation package must match signed governing contract identity fields",
      "Authority record hash must be stored with title filing payload",
    ],
  },
  FL: {
    state: "FL",
    governingLawReferences: [
      "Florida retail installment and motor vehicle sales finance framework",
      "Florida disclosure and fee transparency requirements",
    ],
    requiredDisclosures: [
      "Florida fee itemization disclosure",
      "Optional products and cancellation rights disclosure",
    ],
    requiredPackageDocuments: [
      "Retail Installment Contract",
      "Florida State Disclosure Addendum",
      "Privacy and Data Use Notice",
      "Electronic Signature Consent Record",
      "Chain-of-Custody Certification Summary",
    ],
    wetInkRequiredDocuments: [],
    prohibitedClauses: ["Undisclosed dealer reserve fee language"],
    titlePerfectionRules: [
      "Title package must include lender code, dealer code, and contract hash",
      "Downstream forms must derive from the authoritative record without mutation",
    ],
  },
  NY: {
    state: "NY",
    governingLawReferences: [
      "New York motor vehicle retail installment sales framework",
      "New York consumer credit disclosure and servicing obligations",
    ],
    requiredDisclosures: [
      "New York installment and total cost disclosure",
      "Data usage, privacy, and consent disclosures",
    ],
    requiredPackageDocuments: [
      "Retail Installment Contract",
      "New York State Disclosure Addendum",
      "Privacy and Data Use Notice",
      "Electronic Signature Consent Record",
      "Chain-of-Custody Certification Summary",
    ],
    wetInkRequiredDocuments: [],
    prohibitedClauses: ["Contractual waiver of mandated dispute notice rights"],
    titlePerfectionRules: [
      "Assignment and lien metadata must be immutable once locked",
      "Package emission must include authoritative record checksum references",
    ],
  },
};

