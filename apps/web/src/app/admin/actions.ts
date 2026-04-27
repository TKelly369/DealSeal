"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  DocumentCertificationSchema,
  SystemConfigSchema,
  UserAdminRoleSchema,
  UserAdminUpdateSchema,
} from "@/lib/types";

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
  if (session.user.role !== "ADMIN") {
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

