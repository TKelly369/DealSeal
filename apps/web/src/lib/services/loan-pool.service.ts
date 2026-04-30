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

  async runAiPoolingReview(input: {
    poolId: string;
    lenderId: string;
    actorUserId?: string | null;
  }): Promise<{
    primeCount: number;
    subprimeCount: number;
    otherCount: number;
    recommendedBucket: LoanPoolType;
    recommendationSummary: string;
  }> {
    const pool = await this.getForLender(input.poolId, input.lenderId);
    if (!pool) throw new Error("Pool not found.");

    const classifyTier = (value: string | null | undefined) => {
      const tier = String(value ?? "").trim().toUpperCase();
      if (!tier) return "other";
      if (tier.includes("SUB")) return "subprime";
      if (tier.includes("PRIME") || ["A", "A+", "A-", "B+", "B"].includes(tier)) return "prime";
      return "other";
    };

    let primeCount = 0;
    let subprimeCount = 0;
    let otherCount = 0;
    for (const d of pool.deals) {
      const buyer = await prisma.dealParty.findFirst({ where: { dealId: d.id, role: "BUYER" } });
      const cls = classifyTier(buyer?.creditTier);
      if (cls === "prime") primeCount += 1;
      else if (cls === "subprime") subprimeCount += 1;
      else otherCount += 1;
    }

    const total = pool.deals.length || 1;
    const primeRatio = primeCount / total;
    const subprimeRatio = subprimeCount / total;
    const recommendedBucket =
      primeRatio >= 0.7
        ? LoanPoolType.PRIME
        : subprimeRatio >= 0.5
          ? LoanPoolType.SUBPRIME
          : otherCount > 0
            ? LoanPoolType.MIXED
            : LoanPoolType.NEAR_PRIME;

    const recommendationSummary = `AI review: prime ${primeCount}, subprime ${subprimeCount}, other-market ${otherCount}. Recommended pool distribution: ${recommendedBucket}.`;

    await prisma.loanPool.update({
      where: { id: pool.id },
      data: {
        auditStatus: "HUMAN_FINAL_APPROVAL_REQUIRED",
        filterCriteriaJson: {
          ...(pool.filterCriteriaJson as Record<string, unknown> | null),
          aiPoolingReview: {
            reviewedAt: new Date().toISOString(),
            primeCount,
            subprimeCount,
            otherCount,
            recommendedBucket,
            recommendationSummary,
          },
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.lenderTask.create({
      data: {
        lenderId: input.lenderId,
        poolId: pool.id,
        title: `AI pooling review ready for ${pool.poolName}`,
        description:
          "AI completed package verification and market-bucket recommendation. Lender rep must issue final approval or hold.",
        category: "pooling",
        priority: "high",
        status: "open",
        source: "ai_pooling_review",
        assignedTo: input.actorUserId ?? undefined,
      },
    });

    await recordDealAuditEvent({
      workspaceId: input.lenderId,
      actorUserId: input.actorUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_POOL_AI_REVIEW_COMPLETED",
      entityType: "LoanPool",
      entityId: pool.id,
      payload: {
        primeCount,
        subprimeCount,
        otherCount,
        recommendedBucket,
      },
    });

    return { primeCount, subprimeCount, otherCount, recommendedBucket, recommendationSummary };
  },

  async finalizeAiPoolingDecision(input: {
    poolId: string;
    lenderId: string;
    actorUserId?: string | null;
    decision: "APPROVE" | "HOLD";
    finalBucket?: LoanPoolType;
    note?: string;
  }) {
    const pool = await this.getForLender(input.poolId, input.lenderId);
    if (!pool) throw new Error("Pool not found.");

    if (input.decision === "HOLD") {
      await prisma.loanPool.update({
        where: { id: pool.id },
        data: {
          status: LoanPoolStatus.IN_REVIEW,
          saleStage: LoanPoolSaleStage.IN_REVIEW,
          auditStatus: "ON_HOLD_BY_LENDER_REP",
        },
      });
      await prisma.lenderTask.create({
        data: {
          lenderId: input.lenderId,
          poolId: pool.id,
          title: `Pool hold requires remediation: ${pool.poolName}`,
          description: input.note?.trim() || "Human reviewer put this pool on hold pending arrangement updates.",
          category: "pooling",
          priority: "critical",
          status: "blocked",
          source: "ai_pooling_hold",
          assignedTo: input.actorUserId ?? undefined,
        },
      });
      await recordDealAuditEvent({
        workspaceId: input.lenderId,
        actorUserId: input.actorUserId ?? undefined,
        authMethod: "SESSION",
        action: "LOAN_POOL_HUMAN_HOLD",
        entityType: "LoanPool",
        entityId: pool.id,
        payload: { note: input.note ?? null },
      });
      return { status: "HOLD" as const };
    }

    const finalBucket = input.finalBucket ?? pool.poolType;
    await prisma.$transaction(async (tx) => {
      await tx.loanPool.update({
        where: { id: pool.id },
        data: {
          poolType: finalBucket,
          riskClassification: finalBucket,
          status: LoanPoolStatus.READY_FOR_SALE,
          saleStage: LoanPoolSaleStage.READY_FOR_SALE,
          auditStatus: "FINAL_APPROVED_BY_LENDER_REP",
        },
      });
      await tx.deal.updateMany({
        where: { poolId: pool.id, lenderId: input.lenderId },
        data: {
          secondaryMarketStatus: "AVAILABLE_FOR_SALE",
          secondaryMarketGrade: finalBucket,
        },
      });
      await tx.lenderTask.create({
        data: {
          lenderId: input.lenderId,
          poolId: pool.id,
          title: `Pool approved for market execution: ${pool.poolName}`,
          description:
            "Human final approval captured. AI automation proceeds with package generation and secondary-market preparation.",
          category: "pooling",
          priority: "high",
          status: "completed",
          completedAt: new Date(),
          source: "ai_pooling_approved",
          assignedTo: input.actorUserId ?? undefined,
        },
      });
    });

    const packageResult = await this.generatePoolPackagePlaceholder(pool.id, input.lenderId);
    await recordDealAuditEvent({
      workspaceId: input.lenderId,
      actorUserId: input.actorUserId ?? undefined,
      authMethod: "SESSION",
      action: "LOAN_POOL_HUMAN_FINAL_APPROVED",
      entityType: "LoanPool",
      entityId: pool.id,
      payload: { finalBucket, note: input.note ?? null, packageDigest: packageResult.digest },
    });
    return { status: "APPROVED" as const, digest: packageResult.digest };
  },
};

function rootPrefix(): string {
  const env = process.env.STORAGE_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  return env.replace(/[^a-zA-Z0-9._-]/g, "_");
}
