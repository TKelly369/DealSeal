import crypto from "crypto";
import type { Prisma } from "@/generated/prisma";
import { DealBuilderInput, DealBuilderSchema } from "@/lib/services/types";
import { prisma } from "@/lib/db";
import { assertAuthoritativeContractMutableOrThrow } from "@/lib/services/authoritative-contract-guard";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";

export type DealMutationAuditContext = {
  actorUserId?: string;
  actorRole?: string;
  authMethod?: string;
  ip?: string | null;
};

export const AuthoritativeContractService = {
  async generateCanonicalDeal(dealData: DealBuilderInput, audit?: DealMutationAuditContext) {
    const parsed = DealBuilderSchema.parse(dealData);
    const deal = await prisma.deal.create({
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
            creditTier: parsed.party.contactInfo
              ? `${parsed.party.creditTier ?? ""} | contact:${parsed.party.contactInfo}${parsed.party.coBuyerName ? ` | coBuyer:${parsed.party.coBuyerName}` : ""}`
              : parsed.party.creditTier ?? null,
          },
        },
        dealerRepresentativeName: parsed.dealerRepresentative ?? null,
        governingStateProfile: {
          dealershipLocation: parsed.dealershipLocation ?? null,
          assignedDealerUserId: parsed.assignedDealerUserId ?? null,
          shellCreatedAt: new Date().toISOString(),
        },
        ...(parsed.vehicle.vin
          ? {
              vehicle: {
                create: {
                  year: parsed.vehicle.year ?? new Date().getFullYear(),
                  make: parsed.vehicle.make ?? "UNKNOWN",
                  model: parsed.vehicle.model ?? "UNKNOWN",
                  vin: parsed.vehicle.vin,
                  mileage: parsed.vehicle.mileage ?? 0,
                  condition: parsed.vehicle.condition ?? "USED",
                },
              },
            }
          : {}),
      },
      include: { vehicle: true, financials: true, parties: true },
    });

    await recordDealAuditEvent({
      dealId: deal.id,
      workspaceId: parsed.dealerId,
      actorUserId: audit?.actorUserId,
      actorRole: audit?.actorRole,
      authMethod: audit?.authMethod ?? "SYSTEM",
      action: "DEAL_CREATED",
      entityType: "Deal",
      entityId: deal.id,
      ipAddress: audit?.ip ?? undefined,
      payload: {
        dealerId: parsed.dealerId,
        lenderId: parsed.lenderId,
        dealerLenderLinkId: parsed.dealerLenderLinkId,
      },
    });

    return deal;
  },

  async generateAuthoritativeContract(dealId: string, audit?: DealMutationAuditContext) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { parties: true, vehicle: true, financials: true, authoritativeContract: true },
    });
    if (!deal) throw new Error("Deal not found");
    assertAuthoritativeContractMutableOrThrow(deal, deal.authoritativeContract);

    const hashInput = JSON.stringify({
      id: deal.id,
      state: deal.state,
      parties: deal.parties,
      vehicle: deal.vehicle,
      financials: deal.financials,
    });
    const authoritativeContractHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const prior = await prisma.authoritativeContract.findUnique({ where: { dealId } });
    const nextVersion = (prior?.version ?? 0) + 1;

    const saved = await prisma.authoritativeContract.upsert({
      where: { dealId },
      update: {
        version: nextVersion,
        authoritativeContractHash,
        governingLaw: deal.state,
        signatureStatus: "PENDING",
      },
      create: {
        dealId,
        version: nextVersion,
        authoritativeContractHash,
        governingLaw: deal.state,
        signatureStatus: "PENDING",
      },
    });

    await recordDealAuditEvent({
      dealId,
      workspaceId: deal.dealerId,
      actorUserId: audit?.actorUserId,
      actorRole: audit?.actorRole,
      authMethod: audit?.authMethod ?? "SYSTEM",
      action: "AUTHORITATIVE_CONTRACT_SEALED",
      entityType: "AuthoritativeContract",
      entityId: saved.id,
      deltaAfter: { authoritativeContractHash, version: saved.version } as Prisma.InputJsonValue,
      ipAddress: audit?.ip ?? undefined,
    });

    return saved;
  },

  async generateDownstreamDocument(
    dealId: string,
    docType: "CONTRACT" | "DISCLOSURE" | "BUYERS_ORDER" | "FUNDING_PACKET",
    audit?: DealMutationAuditContext,
  ) {
    const contract = await prisma.authoritativeContract.findUnique({ where: { dealId } });
    if (!contract) throw new Error("Generate authoritative contract first.");
    const qrPayload = `${contract.authoritativeContractHash}|${contract.id}|v${contract.version}`;
    const qrPayloadBase64Url = Buffer.from(qrPayload, "utf8").toString("base64url");

    const doc = await prisma.generatedDocument.create({
      data: {
        dealId,
        authoritativeContractId: contract.id,
        type: docType,
        version: 1,
        authoritativeContractHash: contract.authoritativeContractHash,
        valuesSnapshot: {
          contractHash: contract.authoritativeContractHash,
          source: "authoritative-contract",
          integrityFooter: {
            authoritativeContractHash: contract.authoritativeContractHash,
            qrPayloadBase64Url,
            hint: "QR SHOULD encode qrPayloadBase64Url — proves derivation from AuthoritativeContract hash lineage.",
          },
        },
      },
    });

    const dealMeta = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { dealerId: true },
    });

    await recordDealAuditEvent({
      dealId,
      workspaceId: dealMeta?.dealerId,
      actorUserId: audit?.actorUserId,
      actorRole: audit?.actorRole,
      authMethod: audit?.authMethod ?? "SYSTEM",
      action: "GENERATED_DOCUMENT_RENDERED",
      entityType: "GeneratedDocument",
      entityId: doc.id,
      payload: { type: docType, authoritativeContractHash: contract.authoritativeContractHash },
      ipAddress: audit?.ip ?? undefined,
    });

    return doc;
  },

  async amendDocument(docId: string, newValues: Record<string, unknown>, createdBy?: string) {
    const doc = await prisma.generatedDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new Error("Generated document not found.");
    const deal = await prisma.deal.findUnique({
      where: { id: doc.dealId },
      include: { authoritativeContract: true },
    });
    if (!deal?.authoritativeContract) throw new Error("Deal or authoritative contract not found.");
    assertAuthoritativeContractMutableOrThrow(deal, deal.authoritativeContract);

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
