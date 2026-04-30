import { prisma } from "@/lib/db";
import type { VaultRecordClass } from "@/generated/prisma";

const DEFAULT_RETENTION_YEARS: Record<VaultRecordClass, number> = {
  GOVERNING_CONTRACT: 10,
  DEAL_JACKET: 7,
  AUDIT_LOG: 10,
  CUSTODY_EVENT: 10,
  PACKAGE_MANIFEST: 7,
};

export const EVaultRetentionService = {
  async listPolicies(workspaceId: string) {
    const dbPolicies = await prisma.retentionPolicy.findMany({
      where: { workspaceId },
      orderBy: { recordClass: "asc" },
    });
    const existing = new Set(dbPolicies.map((p) => p.recordClass));
    const defaults = (Object.keys(DEFAULT_RETENTION_YEARS) as VaultRecordClass[])
      .filter((recordClass) => !existing.has(recordClass))
      .map((recordClass) => ({
        id: `default-${recordClass}`,
        workspaceId,
        recordClass,
        jurisdiction: "US",
        retentionYears: DEFAULT_RETENTION_YEARS[recordClass],
        purgeMode: "HASH_ONLY",
        legalHoldExempt: false,
        enabled: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }));
    return [...dbPolicies, ...defaults];
  },

  async upsertPolicy(input: {
    workspaceId: string;
    recordClass: VaultRecordClass;
    retentionYears: number;
    jurisdiction?: string;
    purgeMode?: string;
    enabled?: boolean;
    legalHoldExempt?: boolean;
  }) {
    const jurisdiction = (input.jurisdiction ?? "US").trim() || "US";
    return prisma.retentionPolicy.upsert({
      where: {
        workspaceId_recordClass_jurisdiction: {
          workspaceId: input.workspaceId,
          recordClass: input.recordClass,
          jurisdiction,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        recordClass: input.recordClass,
        jurisdiction,
        retentionYears: input.retentionYears,
        purgeMode: input.purgeMode ?? "HASH_ONLY",
        enabled: input.enabled ?? true,
        legalHoldExempt: input.legalHoldExempt ?? false,
      },
      update: {
        retentionYears: input.retentionYears,
        purgeMode: input.purgeMode ?? "HASH_ONLY",
        enabled: input.enabled ?? true,
        legalHoldExempt: input.legalHoldExempt ?? false,
      },
    });
  },

  async queuePurgeJob(input: {
    workspaceId: string;
    scheduledAt: Date;
    initiatedByUserId?: string;
    policyId?: string;
    dryRun?: boolean;
  }) {
    return prisma.purgeJob.create({
      data: {
        workspaceId: input.workspaceId,
        policyId: input.policyId,
        dryRun: input.dryRun ?? false,
        scheduledAt: input.scheduledAt,
        initiatedByUserId: input.initiatedByUserId,
      },
    });
  },

  async listPurgeJobs(workspaceId: string) {
    return prisma.purgeJob.findMany({
      where: { workspaceId },
      include: { policy: true },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    });
  },
};
