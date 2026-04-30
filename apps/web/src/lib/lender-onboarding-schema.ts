import type { Prisma } from "@/generated/prisma";
import type { AssignmentType, LenderEntityType } from "@/generated/prisma";
import { parseOperatingStates } from "@/lib/dealer-onboarding-schema";

export type LenderOnboardingProfileScalars = Pick<
  Prisma.LenderProfileUncheckedCreateInput,
  "legalName" | "entityType" | "licensedStates" | "acceptedDealerTypes" | "assignmentType"
>;

export type LenderFieldType = "text" | "textarea" | "select" | "radio_yesno";

export type LenderOnboardingField = {
  key: string;
  label: string;
  type: LenderFieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type LenderOnboardingStep = {
  title: string;
  description: string;
  fields: LenderOnboardingField[];
};

const ENTITY_OPTIONS: { value: LenderEntityType; label: string }[] = [
  { value: "BANK", label: "Bank" },
  { value: "CU", label: "Credit union" },
  { value: "CAPTIVE", label: "Captive finance" },
  { value: "FINANCE", label: "Independent finance company" },
];

const APPROVAL_MODE_OPTIONS = [
  { value: "AUTOMATIC", label: "Automatic — approve eligible dealers without manual review" },
  { value: "MANUAL_REVIEW", label: "Manual — staff reviews each dealer request" },
];

const ASSIGNMENT_OPTIONS: { value: AssignmentType; label: string }[] = [
  { value: "IMMEDIATE", label: "Immediate assignment" },
  { value: "CONDITIONAL", label: "Conditional assignment" },
  { value: "POST_FUNDING", label: "Post-funding assignment" },
];

/** Lender onboarding — question groups aligned with program policy capture. */
export const LENDER_ONBOARDING_STEPS: LenderOnboardingStep[] = [
  {
    title: "Legal name & entity type",
    description: "How your organization appears on contracts and regulatory filings.",
    fields: [
      { key: "legal_lender_name", label: "Legal lender name", type: "text", required: true, placeholder: "e.g. ABC Auto Finance LLC" },
      {
        key: "entity_type",
        label: "Entity type",
        type: "select",
        required: true,
        options: ENTITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
    ],
  },
  {
    title: "Licensed states & accepted dealer types",
    description: "Where you are licensed to originate and which dealership categories you buy paper from.",
    fields: [
      {
        key: "licensed_states",
        label: "Licensed states",
        type: "textarea",
        required: true,
        placeholder: "Comma or line-separated (e.g. TX, OK, NM)",
      },
    ],
  },
  {
    title: "Approved dealers & approval workflow",
    description: "Which dealers are already approved or how you identify them, and whether onboarding is automatic.",
    fields: [
      {
        key: "approved_dealers",
        label: "Approved dealers",
        type: "textarea",
        placeholder:
          "List dealer legal names / IDs already approved, or describe criteria (e.g. franchise agreements on file).",
      },
      {
        key: "dealer_approval_mode",
        label: "Manual or automatic dealer approval",
        type: "select",
        required: true,
        options: APPROVAL_MODE_OPTIONS,
      },
    ],
  },
  {
    title: "Required contracts, state forms & disclosures",
    description: "Documents dealers must deliver before funding or boarding.",
    fields: [
      {
        key: "required_contracts",
        label: "Required contracts",
        type: "textarea",
        placeholder: "e.g. Retail installment contract, security agreement, optional addendum list",
      },
      {
        key: "required_state_forms",
        label: "Required state forms",
        type: "textarea",
        placeholder: "State-specific DMV, lien, or notice forms",
      },
      {
        key: "required_disclosures",
        label: "Required disclosures",
        type: "textarea",
        placeholder: "TILA/Reg Z, state credit insurance, gap, etc.",
      },
    ],
  },
  {
    title: "Signature rules & funding documents",
    description: "How deals may be signed and what must be in the funding package.",
    fields: [
      {
        key: "signature_rules",
        label: "Signature rules",
        type: "textarea",
        placeholder: "Wet ink vs e-sign providers, co-buyer rules, POA, remote online notarization policy",
      },
      {
        key: "funding_documents",
        label: "Funding documents",
        type: "textarea",
        placeholder: "Checklist for wire release: title app, insurance, payoff, stips, etc.",
      },
    ],
  },
  {
    title: "Credit, assignment & control",
    description: "Bureau policy, assignment mechanics, and authoritative record expectations.",
    fields: [
      {
        key: "credit_report_required",
        label: "Credit report required?",
        type: "radio_yesno",
        required: true,
      },
      {
        key: "assignment_type",
        label: "Assignment approach",
        type: "select",
        required: true,
        options: ASSIGNMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      },
      {
        key: "assignment_requirements",
        label: "Assignment requirements",
        type: "textarea",
        placeholder: "Endorsements, allonge, electronic chattel paper, UCC filing timing, perfection steps",
      },
      {
        key: "authoritative_control",
        label: "Authoritative copy / control requirements",
        type: "textarea",
        placeholder: "Who holds the authoritative contract copy, vaulting, tamper detection, dealer vs lender custody",
      },
    ],
  },
  {
    title: "Funding rejection triggers",
    description: "Hard stops that prevent funding even when the deal is otherwise structured.",
    fields: [
      {
        key: "funding_rejection_triggers",
        label: "Funding rejection triggers",
        type: "textarea",
        placeholder: "e.g. Open fraud alert, missing title, insurance lapse, stipulations uncleared, compliance red flags",
      },
    ],
  },
];

export const LENDER_DEALER_TYPE_CHECKBOXES = [
  { key: "dealer_type_franchise", label: "Franchise dealers" },
  { key: "dealer_type_independent", label: "Independent dealers" },
  { key: "dealer_type_bhph", label: "Buy-here-pay-here / tote-the-note" },
] as const;

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === 1;
}

function parseEntityType(v: unknown): LenderEntityType {
  const s = String(v ?? "").toUpperCase();
  if (s === "BANK" || s === "CU" || s === "CAPTIVE" || s === "FINANCE") return s;
  return "FINANCE";
}

function parseAssignmentType(v: unknown): AssignmentType {
  const s = String(v ?? "").toUpperCase();
  if (s === "IMMEDIATE" || s === "CONDITIONAL" || s === "POST_FUNDING") return s;
  return "IMMEDIATE";
}

export function parseAcceptedDealerTypesFromAnswers(answers: Record<string, unknown>): string[] {
  const types: string[] = [];
  if (truthy(answers.dealer_type_franchise)) types.push("FRANCHISE");
  if (truthy(answers.dealer_type_independent)) types.push("INDEPENDENT");
  if (truthy(answers.dealer_type_bhph)) types.push("BHPH");
  return types.length > 0 ? types : ["FRANCHISE", "INDEPENDENT"];
}

/** Maps wizard answers → `LenderProfile` scalar fields (create/update). */
export function lenderOnboardingToProfileScalars(answers: Record<string, unknown>): LenderOnboardingProfileScalars {
  const states = parseOperatingStates(String(answers.licensed_states ?? ""));
  return {
    legalName: String(answers.legal_lender_name ?? "").trim() || "Lender",
    entityType: parseEntityType(answers.entity_type),
    licensedStates: states.length > 0 ? states : ["TX"],
    acceptedDealerTypes: parseAcceptedDealerTypesFromAnswers(answers),
    assignmentType: parseAssignmentType(answers.assignment_type),
  };
}

/** Rich answers for `LenderOnboardingAnswer` beyond scalar profile fields. */
export function lenderOnboardingExtendedDetails(answers: Record<string, unknown>) {
  return {
    approvedDealers: String(answers.approved_dealers ?? ""),
    dealerApprovalMode: String(answers.dealer_approval_mode ?? ""),
    requiredContracts: String(answers.required_contracts ?? ""),
    requiredStateForms: String(answers.required_state_forms ?? ""),
    requiredDisclosures: String(answers.required_disclosures ?? ""),
    signatureRules: String(answers.signature_rules ?? ""),
    fundingDocuments: String(answers.funding_documents ?? ""),
    creditReportRequired: String(answers.credit_report_required ?? "") === "yes",
    assignmentRequirements: String(answers.assignment_requirements ?? ""),
    authoritativeCopyControl: String(answers.authoritative_control ?? ""),
    fundingRejectionTriggers: String(answers.funding_rejection_triggers ?? ""),
    dealerTypeSelections: {
      franchise: truthy(answers.dealer_type_franchise),
      independent: truthy(answers.dealer_type_independent),
      bhph: truthy(answers.dealer_type_bhph),
    },
  };
}
