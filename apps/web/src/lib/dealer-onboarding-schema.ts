import type { Prisma } from "@/generated/prisma";
import type { SigningMethod, VehicleTypeSelection } from "@/generated/prisma";

export type DealerOnboardingProfileScalars = Pick<
  Prisma.DealerProfileUncheckedCreateInput,
  | "legalName"
  | "dba"
  | "stateOfFormation"
  | "licenseNumber"
  | "operatingStates"
  | "dmsProvider"
  | "vehicleTypes"
  | "addOnsOffered"
  | "signingMethod"
>;

export type OnboardingFieldType = "text" | "textarea";

export type DealerOnboardingField = {
  key: string;
  label: string;
  type: OnboardingFieldType;
  placeholder?: string;
  required?: boolean;
};

export type DealerOnboardingStep = {
  title: string;
  description: string;
  fields: DealerOnboardingField[];
};

/** Core modules — A. Dealer onboarding (question groups). */
export const DEALER_ONBOARDING_STEPS: DealerOnboardingStep[] = [
  {
    title: "Legal entity & licensing",
    description: "Official dealership identity on your state records.",
    fields: [
      { key: "legal_name", label: "Legal dealer name", type: "text", required: true },
      { key: "dba", label: "DBA (doing business as)", type: "text", placeholder: "Optional trade name" },
      { key: "state_of_formation", label: "State of formation", type: "text", placeholder: "e.g. TX", required: true },
      { key: "license_number", label: "Dealer license number", type: "text", placeholder: "State-issued license #" },
    ],
  },
  {
    title: "Markets & store locations",
    description: "Where you sell and operate.",
    fields: [
      {
        key: "operating_states",
        label: "Operating states",
        type: "textarea",
        placeholder: "Comma or line-separated (e.g. TX, OK, AR)",
        required: true,
      },
      {
        key: "store_locations",
        label: "Store locations",
        type: "textarea",
        placeholder: "Addresses or store names / codes (one per line)",
      },
    ],
  },
  {
    title: "Systems & lender relationships",
    description: "DMS and lender partner picture.",
    fields: [
      { key: "dms_provider", label: "DMS provider", type: "text", placeholder: "e.g. DealerTrack, Reynolds" },
      {
        key: "current_lender_partners",
        label: "Current lender partners",
        type: "textarea",
        placeholder: "Institutions or programs you work with today",
      },
      {
        key: "desired_lender_partners",
        label: "Desired lender partners",
        type: "textarea",
        placeholder: "Who you want to add or expand with",
      },
    ],
  },
  {
    title: "Inventory & add-on products",
    description: "Vehicle types and F&I-style add-ons you offer.",
    fields: [
      { key: "vehicle_types_note", label: "New / used / both (select below)", type: "textarea", placeholder: "Optional notes" },
    ],
  },
  {
    title: "Fees, tax & titling",
    description: "How you handle government and compliance-adjacent flows.",
    fields: [
      {
        key: "doc_fees",
        label: "Doc fees",
        type: "textarea",
        placeholder: "How doc fees are quoted, capped, or disclosed",
      },
      {
        key: "tax_handling",
        label: "Tax handling",
        type: "textarea",
        placeholder: "Sales tax, incentives, trade credit handling",
      },
      {
        key: "title_registration",
        label: "Title and registration process",
        type: "textarea",
        placeholder: "Who handles DMV, timing, temp tags, etc.",
      },
    ],
  },
  {
    title: "Signing method",
    description: "Wet ink, e-sign, or hybrid closing.",
    fields: [
      {
        key: "signing_note",
        label: "Notes (optional)",
        type: "textarea",
        placeholder: "e.g. remote delivery, in-store only, state constraints",
      },
    ],
  },
];

export function parseOperatingStates(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVehicleType(v: unknown): VehicleTypeSelection {
  const s = String(v ?? "").toUpperCase();
  if (s === "NEW" || s === "USED" || s === "BOTH") return s;
  return "BOTH";
}

function parseSigningMethod(v: unknown): SigningMethod {
  const s = String(v ?? "").toUpperCase().replace("-", "_");
  if (s === "WET") return "WET";
  if (s === "E_SIGN" || s === "ESIGN") return "E_SIGN";
  if (s === "HYBRID") return "HYBRID";
  return "HYBRID";
}

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === 1;
}

/** Maps wizard answers → `DealerProfile` scalar fields (create/update). */
export function dealerOnboardingToProfileScalars(answers: Record<string, unknown>): DealerOnboardingProfileScalars {
  const addOns: string[] = [];
  if (truthy(answers.addon_gap)) addOns.push("GAP");
  if (truthy(answers.addon_warranties)) addOns.push("Warranties");
  if (truthy(answers.addon_service_contracts)) addOns.push("Service contracts");
  if (truthy(answers.addon_doc_fees)) addOns.push("Doc fees");

  const states = parseOperatingStates(String(answers.operating_states ?? ""));
  const operatingStates = states.length > 0 ? states : ["TX"];

  return {
    legalName: String(answers.legal_name ?? "").trim() || "Dealer",
    dba: String(answers.dba ?? "").trim() || null,
    stateOfFormation: String(answers.state_of_formation ?? "").trim() || "TX",
    licenseNumber: String(answers.license_number ?? "").trim() || null,
    operatingStates,
    dmsProvider: String(answers.dms_provider ?? "").trim() || null,
    vehicleTypes: parseVehicleType(answers.vehicle_types),
    addOnsOffered: addOns,
    signingMethod: parseSigningMethod(answers.signing_method),
  };
}

/** Rich answers stored on `DealerOnboardingAnswer` beyond scalar profile fields. */
export function dealerOnboardingExtendedDetails(answers: Record<string, unknown>) {
  return {
    storeLocations: String(answers.store_locations ?? ""),
    currentLenderPartners: String(answers.current_lender_partners ?? ""),
    desiredLenderPartners: String(answers.desired_lender_partners ?? ""),
    docFees: String(answers.doc_fees ?? ""),
    taxHandling: String(answers.tax_handling ?? ""),
    titleAndRegistration: String(answers.title_registration ?? ""),
    vehicleTypesNote: String(answers.vehicle_types_note ?? ""),
    signingNote: String(answers.signing_note ?? ""),
    addOnSelections: {
      gap: truthy(answers.addon_gap),
      warranties: truthy(answers.addon_warranties),
      serviceContracts: truthy(answers.addon_service_contracts),
      docFees: truthy(answers.addon_doc_fees),
    },
  };
}
