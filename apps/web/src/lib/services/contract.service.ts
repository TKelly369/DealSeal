import crypto from "crypto";
import type { Prisma } from "@/generated/prisma";
import { DealBuilderInput, DealBuilderSchema } from "@/lib/services/types";
import { prisma } from "@/lib/db";

function toDecimal(n: number) {
  return n.toString();
}

export const AuthoritativeContractService = {
  async generateCanonicalDeal(dealData: DealBuilderInput) {
    const parsed = DealBuilderSchema.parse(dealData);
    return prisma.deal.create({
      data: {
        dealerId: parsed.dealerId,
        lenderId: parsed.lenderId,
        dealerLenderLinkId: parsed.dealerLenderLinkId,
        state: parsed.state,
        status: "DISCLOSURE_REQUIRED",
        parties: {
          create: {
            role: "BUYER",
            firstName: parsed.party.firstName,
            lastName: parsed.party.lastName,
            address: parsed.party.address,
            creditTier: parsed.party.creditTier ?? null,
          },
        },
        vehicle: {
          create: {
            year: parsed.vehicle.year,
            make: parsed.vehicle.make,
            model: parsed.vehicle.model,
            vin: parsed.vehicle.vin,
            mileage: parsed.vehicle.mileage,
            condition: parsed.vehicle.condition,
          },
        },
        financials: {
          create: {
            amountFinanced: toDecimal(parsed.financials.amountFinanced),
            ltv: toDecimal(parsed.financials.ltv),
            maxLtv: toDecimal(parsed.financials.maxLtv),
            taxes: toDecimal(parsed.financials.taxes),
            fees: toDecimal(parsed.financials.fees),
            gap: toDecimal(parsed.financials.gap),
            warranty: toDecimal(parsed.financials.warranty),
            totalSalePrice: toDecimal(parsed.financials.totalSalePrice),
          },
        },
      },
      include: { vehicle: true, financials: true, parties: true },
    });
  },

  async generateAuthoritativeContract(dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { parties: true, vehicle: true, financials: true },
    });
    if (!deal) throw new Error("Deal not found");
    const hashInput = JSON.stringify({
      id: deal.id,
      state: deal.state,
      parties: deal.parties,
      vehicle: deal.vehicle,
      financials: deal.financials,
    });
    const contentHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const prior = await prisma.authoritativeContract.findUnique({ where: { dealId } });
    const nextVersion = (prior?.version ?? 0) + 1;
    return prisma.authoritativeContract.upsert({
      where: { dealId },
      update: {
        version: nextVersion,
        contentHash,
        governingLaw: deal.state,
        signatureStatus: "PENDING",
      },
      create: {
        dealId,
        version: nextVersion,
        contentHash,
        governingLaw: deal.state,
        signatureStatus: "PENDING",
      },
    });
  },

  async generateDownstreamDocument(dealId: string, docType: "CONTRACT" | "DISCLOSURE" | "BUYERS_ORDER" | "FUNDING_PACKET") {
    const contract = await prisma.authoritativeContract.findUnique({ where: { dealId } });
    if (!contract) throw new Error("Generate authoritative contract first.");
    return prisma.generatedDocument.create({
      data: {
        dealId,
        authoritativeContractId: contract.id,
        type: docType,
        version: 1,
        valuesSnapshot: { contractHash: contract.contentHash, source: "authoritative-contract" },
      },
    });
  },

  async amendDocument(docId: string, newValues: Record<string, unknown>, createdBy?: string) {
    const doc = await prisma.generatedDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new Error("Generated document not found.");
    const created = await prisma.documentVersion.create({
      data: {
        generatedDocumentId: docId,
        diff: newValues as Prisma.InputJsonValue,
        createdBy: createdBy ?? null,
      },
    });
    await this.generateAuthoritativeContract(doc.dealId);
    return created;
  },
};
