"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  DocumentCertificationSchema,
  SystemConfigSchema,
  UserAdminRoleSchema,
  UserAdminUpdateSchema,
} from "@/lib/types";
import { prisma } from "@/lib/db";
import { isAdminManagementRole } from "@/lib/role-policy";
import { EVaultRetentionService } from "@/lib/services/evault-retention.service";
import type { VaultRecordClass } from "@/generated/prisma";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "DEALER" | "LENDER" | "ADMIN";
  workspace: string;
  status: "ACTIVE" | "SUSPENDED";
};

export type CertificationQueueRow = {
  id: string;
  submittedBy: string;
  submitterRole: "DEALER" | "LENDER";
  documentType: string;
  dateSubmitted: string;
  status: "PENDING" | "CERTIFIED" | "REJECTED" | "REVOKED";
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  adminUser: string;
  action: string;
  targetEntity: string;
};

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login?next=/admin");
  }
  if (!isAdminManagementRole(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

async function notifyManagementForPurgeApproval(args: {
  workspaceId: string;
  purgeJobId: string;
  scheduledAt: Date;
  legalHoldUntil: Date | null;
  regulatoryDeadlineAt: Date | null;
  requestedBy?: string;
}) {
  await prisma.notification.create({
    data: {
      workspaceId: args.workspaceId,
      type: "PURGE_APPROVAL_REQUIRED",
      title: "Management approval required for purge",
      message: `Purge job ${args.purgeJobId} is pending management authority. Scheduled ${args.scheduledAt.toISOString()}, legal hold until ${args.legalHoldUntil?.toISOString() ?? "n/a"}, regulatory deadline ${args.regulatoryDeadlineAt?.toISOString() ?? "n/a"}, requested by ${args.requestedBy ?? "unknown"}.`,
      isRead: false,
    },
  });
}

const MOCK_USERS: AdminUserRow[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `usr-${i + 1}`,
  name: `Operator ${i + 1}`,
  email: `operator${i + 1}@dealseal1.com`,
  role: i % 7 === 0 ? "ADMIN" : i % 2 === 0 ? "DEALER" : "LENDER",
  workspace: i % 2 === 0 ? "Northstar Motors" : "Summit Finance",
  status: i % 9 === 0 ? "SUSPENDED" : "ACTIVE",
}));

const MOCK_DOCS: CertificationQueueRow[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `doc-${1000 + i}`,
  submittedBy: i % 2 === 0 ? "Northstar Motors" : "Summit Finance",
  submitterRole: i % 2 === 0 ? "DEALER" : "LENDER",
  documentType: i % 3 === 0 ? "Retail Installment Contract" : "Funding Package Addendum",
  dateSubmitted: new Date(Date.now() - i * 36_000_00).toISOString(),
  status: "PENDING",
}));

const MOCK_AUDIT_LOGS: AuditLogRow[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `log-${i + 1}`,
  timestamp: new Date(Date.now() - i * 60_000).toISOString(),
  adminUser: i % 2 === 0 ? "DealSeal Admin" : "Operations Admin",
  action: i % 3 === 0 ? "Updated User" : i % 3 === 1 ? "Certified Doc" : "Updated System Config",
  targetEntity: i % 3 === 0 ? `usr-${i + 1}` : i % 3 === 1 ? `doc-${1000 + i}` : "SystemSettings",
}));

export async function getUsers({
  page = 1,
  limit = 10,
  role = "ALL",
  search = "",
}: {
  page?: number;
  limit?: number;
  role?: "ALL" | "DEALER" | "LENDER" | "ADMIN";
  search?: string;
}) {
  await requireAdminSession();
  // TODO: [Backend Wiring] Replace with Prisma/Drizzle query scoped to global admin
  const filtered = MOCK_USERS.filter((u) => {
    if (role !== "ALL" && u.role !== role) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.workspace.toLowerCase().includes(q)
    );
  });
  const total = filtered.length;
  const start = (page - 1) * limit;
  const rows = filtered.slice(start, start + limit);
  return {
    rows,
    page,
    limit,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function updateUser(input: unknown) {
  await requireAdminSession();
  const parsed = UserAdminUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid user update payload.");
  }
  // TODO: [Backend Wiring] Update DB and Audit Log
  return { ok: true, message: `Updated ${parsed.data.data.name}` };
}

export async function suspendUser({ userId }: { userId: string }) {
  await requireAdminSession();
  if (!userId) throw new Error("User ID is required.");
  // TODO: [Backend Wiring] Update DB and Audit Log
  return { ok: true };
}

export async function getPendingCertificationDocuments({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
  await requireAdminSession();
  // TODO: [Backend Wiring] Query pending certification documents from DB
  const total = MOCK_DOCS.length;
  const start = (page - 1) * limit;
  return {
    rows: MOCK_DOCS.slice(start, start + limit),
    page,
    limit,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function certifyDocument(input: unknown) {
  await requireAdminSession();
  const parsed = DocumentCertificationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid certification payload.");
  }
  // TODO: [Backend Wiring] Update Doc status, generate certification hash/PDF, notify user via email
  return { ok: true };
}

export async function rejectDocument(input: unknown) {
  await requireAdminSession();
  const parsed = DocumentCertificationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid rejection payload.");
  }
  // TODO: [Backend Wiring] Update Doc status, generate certification hash/PDF, notify user via email
  return { ok: true };
}

export async function updateSystemConfig(input: unknown) {
  await requireAdminSession();
  const parsed = SystemConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid system config payload.");
  }
  // TODO: [Backend Wiring] Upsert SystemSettings table
  return { ok: true, config: parsed.data };
}

export async function getAuditLogs({ page = 1, limit = 15 }: { page?: number; limit?: number }) {
  await requireAdminSession();
  // TODO: [Backend Wiring] Query immutable audit log store with pagination
  const start = (page - 1) * limit;
  const rows = MOCK_AUDIT_LOGS.slice(start, start + limit);
  return {
    rows,
    page,
    limit,
    total: MOCK_AUDIT_LOGS.length,
    pageCount: Math.max(1, Math.ceil(MOCK_AUDIT_LOGS.length / limit)),
  };
}

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

export type CustodialPerformanceReport = {
  policy: {
    governingContractYears: number;
    dealJacketYears: number;
  };
  inventory: {
    signedLockedGoverningContracts: number;
    completedDealJackets: number;
  };
  eligible: {
    governingContracts: number;
    dealJackets: number;
  };
  purgeJobs: {
    scheduled: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    running: number;
    failed: number;
    completed: number;
  };
};

export async function getCustodialPerformanceReport(): Promise<CustodialPerformanceReport> {
  const session = await requireAdminSession();
  const policies = await EVaultRetentionService.listPolicies(session.user.workspaceId);
  const governingYears = policies.find((p) => p.recordClass === "GOVERNING_CONTRACT")?.retentionYears ?? 10;
  const jacketYears = policies.find((p) => p.recordClass === "DEAL_JACKET")?.retentionYears ?? 7;
  const governingCutoff = yearsAgo(governingYears);
  const jacketCutoff = yearsAgo(jacketYears);
  let signedLockedGoverningContracts = 0;
  let completedDealJackets = 0;
  let eligibleGoverningContracts = 0;
  let eligibleDealJackets = 0;
  let scheduled = 0;
  let pendingApproval = 0;
  let approved = 0;
  let rejected = 0;
  let running = 0;
  let failed = 0;
  let completed = 0;
  try {
    [
      signedLockedGoverningContracts,
      completedDealJackets,
      eligibleGoverningContracts,
      eligibleDealJackets,
      scheduled,
      pendingApproval,
      approved,
      rejected,
      running,
      failed,
      completed,
    ] =
      await Promise.all([
        prisma.authoritativeContract.count({
          where: {
            deal: { status: { in: ["AUTHORITATIVE_LOCK", "CONSUMMATED"] } },
            signatureStatus: { in: ["SIGNED", "LOCKED"] },
          },
        }),
        prisma.generatedDocument.count({
          where: {
            deal: { status: "CONSUMMATED" },
          },
        }),
        prisma.authoritativeContract.count({
          where: {
            deal: {
              status: { in: ["AUTHORITATIVE_LOCK", "CONSUMMATED"] },
              updatedAt: { lt: governingCutoff },
            },
            signatureStatus: { in: ["SIGNED", "LOCKED"] },
          },
        }),
        prisma.generatedDocument.count({
          where: {
            deal: { status: "CONSUMMATED", updatedAt: { lt: jacketCutoff } },
          },
        }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, status: "SCHEDULED" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, approvalStatus: "PENDING" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, approvalStatus: "APPROVED" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, approvalStatus: "REJECTED" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, status: "RUNNING" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, status: "FAILED" } }),
        prisma.purgeJob.count({ where: { workspaceId: session.user.workspaceId, status: "COMPLETED" } }),
      ]);
  } catch (error) {
    console.error("[DealSeal] Custodial report fallback", error);
  }

  return {
    policy: {
      governingContractYears: governingYears,
      dealJacketYears: jacketYears,
    },
    inventory: {
      signedLockedGoverningContracts,
      completedDealJackets,
    },
    eligible: {
      governingContracts: eligibleGoverningContracts,
      dealJackets: eligibleDealJackets,
    },
    purgeJobs: {
      scheduled,
      pendingApproval,
      approved,
      rejected,
      running,
      failed,
      completed,
    },
  };
}

export async function executeCustodialPurgeRun(): Promise<{ ok: true; purged: { governingContracts: number; dealJackets: number } }> {
  const session = await requireAdminSession();
  const now = new Date();
  const jobToRun = await prisma.purgeJob.findFirst({
    where: {
      workspaceId: session.user.workspaceId,
      status: "SCHEDULED",
      approvalStatus: "APPROVED",
      scheduledAt: { lte: now },
      OR: [{ legalHoldUntil: null }, { legalHoldUntil: { lte: now } }],
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (!jobToRun) {
    throw new Error("No management-approved purge job is eligible to run yet.");
  }
  const policies = await EVaultRetentionService.listPolicies(session.user.workspaceId);
  const governingYears = policies.find((p) => p.recordClass === "GOVERNING_CONTRACT")?.retentionYears ?? 10;
  const jacketYears = policies.find((p) => p.recordClass === "DEAL_JACKET")?.retentionYears ?? 7;
  const governingCutoff = yearsAgo(governingYears);
  const jacketCutoff = yearsAgo(jacketYears);

  // Contract retention: after legal window, mark status as purged while preserving hash chain.
  let governingPurged = 0;
  let jacketPurged = 0;
  let failed = false;
  let errorMessage: string | null = null;
  const purgeJob = await prisma.purgeJob.update({
    where: { id: jobToRun.id },
    data: {
      startedAt: new Date(),
      status: "RUNNING",
      summary: {
        ...(typeof jobToRun.summary === "object" && jobToRun.summary ? jobToRun.summary : {}),
        executionStartedBy: session.user.id,
      },
    },
  });
  try {
    const governing = await prisma.authoritativeContract.updateMany({
      where: {
        deal: {
          status: { in: ["AUTHORITATIVE_LOCK", "CONSUMMATED"] },
          updatedAt: { lt: governingCutoff },
        },
        signatureStatus: { in: ["SIGNED", "LOCKED"] },
      },
      data: {
        signatureStatus: "PURGED_AFTER_RETENTION",
      },
    });
    governingPurged = governing.count;

    // Deal jacket retention: strip direct file URL pointers after legal retention window.
    const jacketRows = await prisma.generatedDocument.findMany({
      where: {
        deal: {
          status: "CONSUMMATED",
          updatedAt: { lt: jacketCutoff },
        },
      },
      select: { id: true, valuesSnapshot: true },
    });

    for (const row of jacketRows) {
      const snapshot =
        row.valuesSnapshot && typeof row.valuesSnapshot === "object" && !Array.isArray(row.valuesSnapshot)
          ? (row.valuesSnapshot as Record<string, unknown>)
          : {};
      await prisma.generatedDocument.update({
        where: { id: row.id },
        data: {
          fileUrl: null,
          valuesSnapshot: {
            ...snapshot,
            custodyPurgedAt: new Date().toISOString(),
            custodyPurgeReason: `Retention met (${jacketYears}y)`,
          },
        },
      });
    }
    jacketPurged = jacketRows.length;
  } catch (error) {
    console.error("[DealSeal] Custodial purge fallback", error);
    failed = true;
    errorMessage = error instanceof Error ? error.message : "Unknown purge error";
  }

  try {
    await prisma.userAccessAudit.create({
      data: {
        userId: session.user.id,
        workspaceId: session.user.workspaceId,
        fullName: session.user.name ?? session.user.email ?? "Dealseal Admin",
        title: "SYSTEM_ADMIN",
        metadata: {
          eventType: "CUSTODIAL_PURGE_RUN",
          governingContractsPurged: governingPurged,
          dealJacketsPurged: jacketPurged,
          governingRetentionYears: governingYears,
          dealJacketRetentionYears: jacketYears,
          source: "/admin/system-config",
          purgeJobId: purgeJob.id,
        },
      },
    });
  } catch {
    // Purge run should not fail if audit write is unavailable.
  }
  await prisma.purgeJob.update({
    where: { id: purgeJob.id },
    data: {
      status: failed ? "FAILED" : "COMPLETED",
      finishedAt: new Date(),
      errorMessage: errorMessage ?? undefined,
      summary: {
        governingContractsPurged: governingPurged,
        dealJacketsPurged: jacketPurged,
        governingRetentionYears: governingYears,
        dealJacketRetentionYears: jacketYears,
      },
    },
  });

  return {
    ok: true,
    purged: {
      governingContracts: governingPurged,
      dealJackets: jacketPurged,
    },
  };
}

export async function updateRetentionPolicy(input: {
  recordClass: VaultRecordClass;
  retentionYears: number;
  purgeMode?: string;
  enabled?: boolean;
}) {
  const session = await requireAdminSession();
  await EVaultRetentionService.upsertPolicy({
    workspaceId: session.user.workspaceId,
    recordClass: input.recordClass,
    retentionYears: input.retentionYears,
    purgeMode: input.purgeMode ?? "HASH_ONLY",
    enabled: input.enabled ?? true,
  });
  return { ok: true };
}

export async function scheduleCustodialPurgeRun(input: { scheduledAt: string; dryRun?: boolean }) {
  const session = await requireAdminSession();
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Invalid schedule date.");
  const policy = await prisma.retentionPolicy.findFirst({
    where: { workspaceId: session.user.workspaceId, recordClass: "DEAL_JACKET", enabled: true },
    select: { id: true, recordClass: true },
  });
  const job = await EVaultRetentionService.queuePurgeJob({
    workspaceId: session.user.workspaceId,
    scheduledAt: when,
    policyId: policy?.id,
    recordClass: policy?.recordClass ?? "DEAL_JACKET",
    dryRun: input.dryRun ?? false,
    initiatedByUserId: session.user.id,
  });
  await notifyManagementForPurgeApproval({
    workspaceId: session.user.workspaceId,
    purgeJobId: job.id,
    scheduledAt: job.scheduledAt,
    legalHoldUntil: job.legalHoldUntil,
    regulatoryDeadlineAt: job.regulatoryDeadlineAt,
    requestedBy: session.user.email ?? session.user.id,
  });
  return { ok: true };
}

export async function approveCustodialPurgeRun(input: { purgeJobId: string; approvalNote?: string }) {
  const session = await requireAdminSession();
  const job = await prisma.purgeJob.findFirst({
    where: { id: input.purgeJobId, workspaceId: session.user.workspaceId },
  });
  if (!job) throw new Error("Purge job not found.");
  await prisma.purgeJob.update({
    where: { id: job.id },
    data: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
      approvalNote: input.approvalNote?.trim() || "Approved by management authority.",
    },
  });
  return { ok: true };
}

export async function rejectCustodialPurgeRun(input: { purgeJobId: string; approvalNote?: string }) {
  const session = await requireAdminSession();
  const job = await prisma.purgeJob.findFirst({
    where: { id: input.purgeJobId, workspaceId: session.user.workspaceId },
  });
  if (!job) throw new Error("Purge job not found.");
  await prisma.purgeJob.update({
    where: { id: job.id },
    data: {
      approvalStatus: "REJECTED",
      status: "CANCELLED",
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
      approvalNote: input.approvalNote?.trim() || "Rejected by management authority.",
      finishedAt: new Date(),
    },
  });
  return { ok: true };
}

