import crypto from "node:crypto";
import {
  LoanPoolSaleStage,
  LoanPoolStatus,
  LoanPoolType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { getDealSealStorage } from "@/lib/storage/deal-seal-storage";
import { computePoolIntegrityStatus, evaluateDealForPooling } from "@/lib/services/loan-pool-validation";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";

export type PoolDealFilters = {
  creditTierIncludes?: string[];
  aprMin?: number;
  aprMax?: number;
  amountMin?: number;
  amountMax?: number;
  termMonthsMin?: number;
  termMonthsMax?: number;
  vehicleType?: "NEW" | "USED";
  state?: string;
  dealerId?: string;
  fundedAfter?: string;
  fundedBefore?: string;
};

async function recalculatePoolMetrics(poolId: string): Promise<void> {
  const deals = await prisma.deal.findMany({
    where: { poolId },
    include: { financials: true },
  });
  let principal = 0;
  let aprSum = 0;
  let termSum = 0;
  let n = 0;
  for (const d of deals) {
    if (!d.financials) continue;
    principal += Number(d.financials.amountFinanced);
    // Placeholder until a dedicated `annualPercentageRate` field exists on financials
    const proxy = Number(d.financials.ltv);
    aprSum += proxy;
    termSum += 60;
    n += 1;
  }
  const weightedApr = n > 0 ? aprSum / n : null;
  const weightedTerm = n > 0 ? Math.round(termSum / n) : null;

  const integrity = await computePoolIntegrityStatus(poolId);

  await prisma.loanPool.update({
    where: { id: poolId },
    data: {
      totalLoanCount: deals.length,
      totalPrincipalBalance: principal,
      weightedAverageApr: weightedApr ?? undefined,
      weightedAverageTermMonths: weightedTerm ?? undefined,
      poolIntegrityStatus: integrity,
    },
  });
}

export const LoanPoolService = {
  async listForLender(lenderId: string) {
    return prisma.loanPool.findMany({
      where: { lenderId },
      orderBy: { updatedAt: "desc" },
    });
  },

  async getForLender(poolId: string, lenderId: string) {
    return prisma.loanPool.findFirst({
      where: { id: poolId, lenderId },
      include: {
        deals: {
          include: {
            dealer: { select: { name: true } },
            vehicle: true,
            financials: true,
            authoritativeContract: { select: { id: true, authoritativeContractHash: true } },
          },
        },
      },
    });
  },

  async createPool(input: {
    lenderId: string;
    createdByUserId?: string | null;
    poolName: string;
    poolType: LoanPoolType;
    description?: string | null;
    targetSize: number;
    filterCriteria?: PoolDealFilters | null;
  }) {
    const pool = await prisma.loanPool.create({
      data: {
        lenderId: input.lenderId,
        poolName: input.poolName,
        poolType: input.poolType,
        description: input.description ?? undefined,
        targetSize: input.targetSize,
        status: "DRAFT",
        filterCriteriaJson: (input.filterCriteria ?? undefined) as Prisma.InputJsonValue | undefined,
        createdByUserId: input.createdByUserId ?? undefined,
      },
    });

    await recordDealAuditEvent({
      workspaceId: input.lenderId,
      actorUserId: input.createdByUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_POOL_CREATED",
      entityType: "LoanPool",
      entityId: pool.id,
      payload: { poolName: pool.poolName, poolType: pool.poolType },
    });

    return pool;
  },

  async addDealToPool(input: {
    poolId: string;
    dealId: string;
    lenderId: string;
    actorUserId?: string | null;
  }): Promise<void> {
    const pool = await prisma.loanPool.findFirst({
      where: { id: input.poolId, lenderId: input.lenderId },
    });
    if (!pool) throw new Error("Pool not found.");
    if (["SOLD", "ARCHIVED", "TRANSFERRED"].includes(pool.status as string)) {
      throw new Error("Pool is closed for new loans.");
    }

    const eligibility = await evaluateDealForPooling(input.dealId, input.lenderId);
    if (!eligibility.eligible) {
      throw new Error(`Deal not eligible: ${eligibility.reasons.join(" ")}`);
    }

    const deal = await prisma.deal.findUnique({ where: { id: input.dealId } });
    if (!deal || deal.lenderId !== input.lenderId) throw new Error("Deal not found.");
    if (deal.poolId && deal.poolId !== input.poolId) throw new Error("Deal already assigned to another pool.");

    await prisma.deal.update({
      where: { id: input.dealId },
      data: { poolId: input.poolId },
    });

    await recalculatePoolMetrics(input.poolId);

    await recordDealAuditEvent({
      dealId: input.dealId,
      workspaceId: input.lenderId,
      actorUserId: input.actorUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_ADDED_TO_POOL",
      entityType: "LoanPool",
      entityId: input.poolId,
      payload: { dealId: input.dealId },
    });
  },

  async removeDealFromPool(input: {
    poolId: string;
    dealId: string;
    lenderId: string;
    actorUserId?: string | null;
  }): Promise<void> {
    const pool = await prisma.loanPool.findFirst({
      where: { id: input.poolId, lenderId: input.lenderId },
    });
    if (!pool) throw new Error("Pool not found.");
    if (pool.status === "LOCKED" || pool.status === "SOLD") {
      throw new Error("Cannot remove loans from a locked or sold pool.");
    }

    await prisma.deal.updateMany({
      where: { id: input.dealId, poolId: input.poolId, lenderId: input.lenderId },
      data: { poolId: null },
    });

    await recalculatePoolMetrics(input.poolId);

    await recordDealAuditEvent({
      dealId: input.dealId,
      workspaceId: input.lenderId,
      actorUserId: input.actorUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_REMOVED_FROM_POOL",
      entityType: "LoanPool",
      entityId: input.poolId,
      payload: { dealId: input.dealId },
    });
  },

  async updatePoolStatus(input: {
    poolId: string;
    lenderId: string;
    status: LoanPoolStatus;
    saleStage?: LoanPoolSaleStage;
    transferEntityName?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    await prisma.loanPool.updateMany({
      where: { id: input.poolId, lenderId: input.lenderId },
      data: {
        status: input.status,
        ...(input.saleStage !== undefined ? { saleStage: input.saleStage } : {}),
        ...(input.transferEntityName !== undefined ? { transferEntityName: input.transferEntityName } : {}),
        ...(input.status === LoanPoolStatus.TRANSFERRED || input.status === LoanPoolStatus.SOLD
          ? { transferDate: new Date() }
          : {}),
      },
    });

    await recordDealAuditEvent({
      workspaceId: input.lenderId,
      actorUserId: input.actorUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_POOL_STATUS_UPDATED",
      entityType: "LoanPool",
      entityId: input.poolId,
      payload: { status: input.status, saleStage: input.saleStage },
    });
  },

  /** Placeholder package manifest + optional JSON export (data tape ready). */
  async generatePoolPackagePlaceholder(poolId: string, lenderId: string): Promise<{ digest: string; summary: object }> {
    const pool = await this.getForLender(poolId, lenderId);
    if (!pool) throw new Error("Pool not found.");

    const integrity = await computePoolIntegrityStatus(poolId);
    const summary = {
      poolId: pool.id,
      poolName: pool.poolName,
      integrity,
      loans: pool.deals.map((d) => ({
        dealId: d.id,
        authoritativeContractId: d.authoritativeContract?.id ?? null,
        authoritativeContractHash: d.authoritativeContract?.authoritativeContractHash ?? null,
        principal: d.financials ? Number(d.financials.amountFinanced) : null,
      })),
      generatedAt: new Date().toISOString(),
    };

    const digest = crypto.createHash("sha256").update(JSON.stringify(summary)).digest("hex");
    const key = `${rootPrefix()}/${lenderId}/loan-pools/${poolId}/package-${digest.slice(0, 12)}.json`;

    const storage = getDealSealStorage();
    await storage.putObject({
      key,
      body: Buffer.from(JSON.stringify(summary, null, 2), "utf8"),
      contentType: "application/json",
      computeSha256: true,
    });

    await prisma.loanPool.update({
      where: { id: poolId },
      data: {
        lastPackageStorageKey: key,
        lastPackageGeneratedAt: new Date(),
      },
    });

    await recordDealAuditEvent({
      workspaceId: lenderId,
      authMethod: "SESSION",
      action: "LOAN_POOL_PACKAGE_GENERATED",
      entityType: "LoanPool",
      entityId: poolId,
      payload: { digest, storageKey: key },
    });

    return { digest, summary };
  },
};

function rootPrefix(): string {
  const env = process.env.STORAGE_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  return env.replace(/[^a-zA-Z0-9._-]/g, "_");
}
