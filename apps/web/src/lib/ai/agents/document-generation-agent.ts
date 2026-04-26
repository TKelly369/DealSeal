import type { GeneratedDealerDocument } from "@/lib/ai/agents/types";

type DocumentGenerationInput = {
  state: string;
  buyerName: string;
  dealerId: string;
  lenderId: string;
  vin: string;
  amountFinanced: number;
  termMonths: number;
  serviceContracts: number;
};

export class DocumentGenerationAgent {
  generateRequiredDocuments(input: DocumentGenerationInput): GeneratedDealerDocument[] {
    const serviceContractRequired = input.serviceContracts > 0;
    const gapRequired = input.amountFinanced > 0 && input.termMonths >= 60;
    const hasCoreIdentity = Boolean(input.state && input.buyerName && input.dealerId && input.lenderId && input.vin);

    return [
      {
        docType: "Retail Installment Sale Contract",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "dealerId", "lenderId", "vin", "cashPrice", "amountFinanced", "apr", "termMonths"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Buyer’s Order",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "cashPrice", "taxes", "fees"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Odometer Disclosure",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "mileage", "dealerId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Title Application",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "vin", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Lien Filing Instructions",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["vin", "lenderId", "dealerId", "buyer.name"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Assignment Agreement / Assignment Addendum",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["dealerId", "lenderId", "vin", "amountFinanced", "apr", "termMonths"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Privacy Notice",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "dealerId", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Credit Application",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "amountFinanced"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Insurance Acknowledgment",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Service Contract Disclosure",
        required: serviceContractRequired,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "serviceContracts"],
        status: serviceContractRequired ? (hasCoreIdentity ? "READY" : "BLOCKED") : "READY",
      },
      {
        docType: "GAP Disclosure",
        required: gapRequired,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "amountFinanced", "termMonths"],
        status: gapRequired ? (hasCoreIdentity ? "READY" : "BLOCKED") : "READY",
      },
      {
        docType: "State-specific notices placeholder",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["state", "buyer.name", "dealerId", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
    ];
  }
}
