import { DealComplianceStatus, ComplianceRuleSet, DocumentType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { ComplianceResult } from "@/lib/services/types";

export type UccArticle9Validation = { compliant: boolean; reasons: string[] };

function normalizeVin(vin: string) {
  return vin.trim().toUpperCase();
}

function normalizeDebtorName(first: string, last: string) {
  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

/** UCC Article 9 collateral/debtor checks before AUTHORITATIVE_LOCK. */
export async function validateUCCArticle9(dealId: string): Promise<UccArticle9Validation> {
  const reasons: string[] = [];
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      vehicle: true,
      parties: true,
      generatedDocuments: {
        where: { documentType: DocumentType.RISC_LENDER_FINAL },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!deal?.vehicle) {
    reasons.push("Vehicle collateral is required.");
    return { compliant: false, reasons };
  }

  const buyer = deal.parties.find((p) => p.role === "BUYER");
  if (!buyer) {
    reasons.push("Buyer (debtor) is required.");
    return { compliant: false, reasons };
  }

  const vin = normalizeVin(deal.vehicle.vin);
  if (vin.length < 11) {
    reasons.push("VIN on file is incomplete.");
  }

  const debtorName = normalizeDebtorName(buyer.firstName, buyer.lastName);
  if (!debtorName) {
    reasons.push("Debtor name is empty.");
  }

  const risc = deal.generatedDocuments[0];
  if (!risc) {
    reasons.push("Lender-final contract must exist before lock.");
  } else {
    const snap = risc.valuesSnapshot;
    const snapStr = JSON.stringify(snap ?? {}).toLowerCase();
    const hasSecurityLanguage =
      snapStr.includes("security interest") ||
      snapStr.includes("security agreement") ||
      (typeof snap === "object" &&
        snap !== null &&
        (snap as Record<string, unknown>).securityAgreementPresent === true);
    if (!hasSecurityLanguage) {
      reasons.push("Security agreement must be recorded on the lender-final contract package.");
    }
  }

  const compliant = reasons.length === 0;
  return { compliant, reasons };
}

function summarizeStatus(statuses: DealComplianceStatus[]): DealComplianceStatus {
  if (statuses.includes(DealComplianceStatus.BLOCKED)) return DealComplianceStatus.BLOCKED;
  if (statuses.includes(DealComplianceStatus.WARNING)) return DealComplianceStatus.WARNING;
  return DealComplianceStatus.COMPLIANT;
}

export const ComplianceEngineService = {
  async runStateCompliance(dealId: string): Promise<ComplianceResult> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { financials: true, parties: true, vehicle: true, dealer: true, lender: true },
    });
    if (!deal) {
      return { status: "BLOCKED", checks: [] };
    }
    if (deal.status === "DISCLOSURE_REQUIRED" || !deal.initialDisclosureAcceptedAt) {
      return {
        status: "BLOCKED",
        checks: [
          {
            id: `state-disclosure-gate-${dealId}`,
            ruleSet: "STATE",
            status: "BLOCKED",
            affectedField: "initialDisclosure",
            explanation: "Signed Initial Disclosure must be uploaded and accepted before compliance analysis.",
            ruleSource: "DealSeal gating policy",
            suggestedCorrection: "Upload signed initial disclosure and required metadata.",
          },
        ],
      };
    }
    if (!deal.financials) {
      return { status: "BLOCKED", checks: [] };
    }

    const buyer = deal.parties.find((p) => p.role === "BUYER");
    const inferredStateProfile = {
      dealershipState: deal.state,
      customerAddress: buyer?.address ?? null,
      vehicleLocationState: deal.state,
      deliveryState: deal.state,
      contractState: deal.state,
      lenderProgramState: deal.state,
    };

    const checks = [
      {
        id: `state-profile-${dealId}`,
        ruleSet: ComplianceRuleSet.STATE,
        status: DealComplianceStatus.COMPLIANT,
        affectedField: "stateProfile",
        explanation: "State profile determined from dealership, customer, vehicle, delivery, contract, and lender program states.",
        ruleSource: `${deal.state} governing profile`,
        suggestedCorrection: null,
      },
      {
        id: `state-tax-${dealId}`,
        ruleSet: ComplianceRuleSet.STATE,
        status: Number(deal.financials.taxes) >= 0 ? DealComplianceStatus.COMPLIANT : DealComplianceStatus.BLOCKED,
        affectedField: "taxes",
        explanation: "Taxes must be present and non-negative.",
        ruleSource: `${deal.state} tax disclosure`,
        suggestedCorrection: Number(deal.financials.taxes) >= 0 ? null : "Set taxes to valid value.",
      },
      {
        id: `state-fee-${dealId}`,
        ruleSet: ComplianceRuleSet.STATE,
        status: Number(deal.financials.fees) <= 900 ? DealComplianceStatus.COMPLIANT : DealComplianceStatus.WARNING,
        affectedField: "fees",
        explanation: "High doc/processing fees require explicit state disclosure language.",
        ruleSource: `${deal.state} doc fee guidance`,
        suggestedCorrection: Number(deal.financials.fees) <= 900 ? null : "Add fee disclosure or reduce fee.",
      },
    ];

    await prisma.deal.update({
      where: { id: dealId },
      data: { governingStateProfile: inferredStateProfile as unknown as object },
    });

    return {
      status: summarizeStatus(checks.map((c) => c.status)),
      checks: checks.map((c) => ({ ...c, status: c.status as "COMPLIANT" | "WARNING" | "BLOCKED" })),
    };
  },

  async runLenderCompliance(dealId: string): Promise<ComplianceResult> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { financials: true, lender: true },
    });
    if (!deal || !deal.financials) {
      return { status: "BLOCKED", checks: [] };
    }
    if (deal.status === "DISCLOSURE_REQUIRED" || !deal.initialDisclosureAcceptedAt) {
      return {
        status: "BLOCKED",
        checks: [
          {
            id: `lender-disclosure-gate-${dealId}`,
            ruleSet: "LENDER",
            status: "BLOCKED",
            affectedField: "initialDisclosure",
            explanation: "Signed Initial Disclosure must be accepted before lender compliance checks.",
            ruleSource: `${deal.lender.name} onboarding gate`,
            suggestedCorrection: "Complete initial disclosure gate first.",
          },
        ],
      };
    }

    const checks = [
      {
        id: `lender-ltv-${dealId}`,
        ruleSet: ComplianceRuleSet.LENDER,
        status: Number(deal.financials.ltv) <= Number(deal.financials.maxLtv)
          ? DealComplianceStatus.COMPLIANT
          : DealComplianceStatus.BLOCKED,
        affectedField: "ltv",
        explanation: "Loan-to-value must be less than or equal to lender threshold.",
        ruleSource: `${deal.lender.name} LTV profile`,
        suggestedCorrection: Number(deal.financials.ltv) <= Number(deal.financials.maxLtv) ? null : "Adjust down payment or reduce financed amount.",
      },
      {
        id: `lender-sale-price-${dealId}`,
        ruleSet: ComplianceRuleSet.LENDER,
        status: Number(deal.financials.totalSalePrice) > 0 ? DealComplianceStatus.COMPLIANT : DealComplianceStatus.BLOCKED,
        affectedField: "totalSalePrice",
        explanation: "Total sale price must be populated for funding packet validation.",
        ruleSource: `${deal.lender.name} funding checklist`,
        suggestedCorrection: Number(deal.financials.totalSalePrice) > 0 ? null : "Provide total sale price.",
      },
    ];

    return {
      status: summarizeStatus(checks.map((c) => c.status)),
      checks: checks.map((c) => ({ ...c, status: c.status as "COMPLIANT" | "WARNING" | "BLOCKED" })),
    };
  },
};
