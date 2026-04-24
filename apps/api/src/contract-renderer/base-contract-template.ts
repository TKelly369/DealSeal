import type { GoverningRecord } from "@prisma/client";
import { canonicalStringify, baseTemplateBodyHash } from "../lib/record-hashing.js";

/**
 * Single source for certified and convenience PDFs. Only overlay layers differ.
 */
export const KIND_BASE = "Deal-Scan.ContractBaseTemplate" as const;

export type BaseContractViewModel = {
  kind: typeof KIND_BASE;
  version: 1;
  recordId: string;
  publicRef: string;
  governVersion: number;
  title: string;
  sections: { heading: string; body: string }[];
};

const CERT_TEXT =
  "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in Deal-Scan. The authoritative record remains in system custody and is verifiable via Record ID and hash.";

const CONV_TEXT =
  "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";

export function getCertifiedAttestationText(): string {
  return CERT_TEXT;
}

export function getConvenienceDisclaimerText(): string {
  return CONV_TEXT;
}

/**
 * Map governing record JSON to the one shared base template the renderer uses (certified and convenience).
 */
export function buildBaseViewModelFromGoverningRecord(gr: GoverningRecord): BaseContractViewModel {
  const data = gr.recordDataJson as {
    governingAgreement?: { title?: string; referenceCode?: string } | null;
    transaction?: { publicId?: string; state?: string } | null;
    buyer?: { legalName?: string } | null;
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; vin?: string | null } | null;
    financials?: { amountFinanced?: string } | null;
    sourceInstrument?: { documentSha256?: string } | null;
  };
  const title = data.governingAgreement?.title ?? "Retail Installment Contract";
  const sections: BaseContractViewModel["sections"] = [
    { heading: "Reference", body: `Public deal ID: ${data.transaction?.publicId ?? "—"}\nGoverning ref: ${data.governingAgreement?.referenceCode ?? "—"}\nState: ${data.transaction?.state ?? "—"}` },
    { heading: "Buyer", body: data.buyer?.legalName ? `Name: ${data.buyer.legalName}` : "Name: (not on record)" },
  ];
  if (data.vehicle) {
    sections.push({
      heading: "Vehicle",
      body: [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ") + (data.vehicle.vin ? `\nVIN: ${data.vehicle.vin}` : ""),
    });
  }
  if (data.financials?.amountFinanced) {
    sections.push({ heading: "Amount financed", body: data.financials.amountFinanced });
  }
  if (data.sourceInstrument?.documentSha256) {
    sections.push({ heading: "Source instrument (SHA-256)", body: data.sourceInstrument.documentSha256 });
  }
  return {
    kind: KIND_BASE,
    version: 1,
    recordId: gr.id,
    publicRef: gr.publicRef,
    governVersion: gr.version,
    title,
    sections,
  };
}

export function baseViewModelContentHash(model: BaseContractViewModel): string {
  return baseTemplateBodyHash(model);
}

/** For tests: two modes must serialize to the same string before any overlay. */
export function assertSameBaseModel(a: BaseContractViewModel, b: BaseContractViewModel): void {
  const sa = canonicalStringify(a);
  const sb = canonicalStringify(b);
  if (sa !== sb) {
    throw new Error("Base contract template mismatch between render modes (must be identical before overlays).");
  }
}

export { canonicalStringify };
