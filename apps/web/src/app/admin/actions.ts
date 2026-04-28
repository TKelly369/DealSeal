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
    redirect("/login?next=/admin");
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PLATFORM_ADMIN") {
    redirect("/dashboard");
  }
  return session;
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

const GOVERNING_CONTRACT_RETENTION_YEARS = 10;
const DEAL_JACKET_RETENTION_YEARS = 7;

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
};

export async function getCustodialPerformanceReport(): Promise<CustodialPerformanceReport> {
  await requireAdminSession();
  const governingCutoff = yearsAgo(GOVERNING_CONTRACT_RETENTION_YEARS);
  const jacketCutoff = yearsAgo(DEAL_JACKET_RETENTION_YEARS);

  const [signedLockedGoverningContracts, completedDealJackets, eligibleGoverningContracts, eligibleDealJackets] =
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
    ]);

  return {
    policy: {
      governingContractYears: GOVERNING_CONTRACT_RETENTION_YEARS,
      dealJacketYears: DEAL_JACKET_RETENTION_YEARS,
    },
    inventory: {
      signedLockedGoverningContracts,
      completedDealJackets,
    },
    eligible: {
      governingContracts: eligibleGoverningContracts,
      dealJackets: eligibleDealJackets,
    },
  };
}

export async function executeCustodialPurgeRun(): Promise<{ ok: true; purged: { governingContracts: number; dealJackets: number } }> {
  const session = await requireAdminSession();
  const governingCutoff = yearsAgo(GOVERNING_CONTRACT_RETENTION_YEARS);
  const jacketCutoff = yearsAgo(DEAL_JACKET_RETENTION_YEARS);

  // Contract retention: after legal window, mark status as purged while preserving hash chain.
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
          custodyPurgeReason: `Retention met (${DEAL_JACKET_RETENTION_YEARS}y)`,
        },
      },
    });
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
          governingContractsPurged: governing.count,
          dealJacketsPurged: jacketRows.length,
          governingRetentionYears: GOVERNING_CONTRACT_RETENTION_YEARS,
          dealJacketRetentionYears: DEAL_JACKET_RETENTION_YEARS,
          source: "/admin/system-config",
        },
      },
    });
  } catch {
    // Purge run should not fail if audit write is unavailable.
  }

  return {
    ok: true,
    purged: {
      governingContracts: governing.count,
      dealJackets: jacketRows.length,
    },
  };
}

