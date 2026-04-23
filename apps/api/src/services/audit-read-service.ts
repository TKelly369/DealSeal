import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import {
  getTransactionTimeline,
  type TimelineItem,
} from "./audit-query-service.js";

export type NormalizedTimelineEntry = {
  id: string;
  createdAt: string;
  channel: TimelineItem["source"];
  title: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload: unknown;
};

function titleFor(it: TimelineItem): string {
  if (it.source === "state") {
    const d = it.data as { fromState?: string; toState?: string };
    return `State: ${d.fromState ?? "?"} → ${d.toState}`;
  }
  if (it.source === "audit") {
    const d = it.data as { eventType?: string; action?: string };
    return d.eventType ?? d.action ?? "Audit";
  }
  if (it.source === "document") {
    const d = it.data as { documentType?: string; version?: number };
    return `Document ${d.documentType ?? "?"} v${d.version ?? "?"}`;
  }
  const d = it.data as { status?: string };
  return `Package job ${d.status ?? "?"}`;
}

export function normalizeTimelineItems(items: TimelineItem[]): NormalizedTimelineEntry[] {
  return items.map((it) => {
    const data = it.data as Record<string, unknown>;
    let entityType: string | null = null;
    let entityId: string | null = null;
    if (it.source === "audit") {
      entityType =
        (data.entityType as string | undefined) ??
        (data.resource as string | undefined) ??
        null;
      entityId =
        (data.entityId as string | undefined) ??
        (data.resourceId as string | undefined) ??
        null;
    } else if (it.source === "document") {
      entityType = "Document";
      entityId = (data.documentId as string | undefined) ?? it.id;
    } else if (it.source === "state") {
      entityType = "StateTransition";
      entityId = (data.transactionId as string | undefined) ?? it.id;
    } else {
      entityType = "PackageJob";
      entityId = it.id;
    }
    return {
      id: `${it.source}:${it.id}`,
      createdAt: it.createdAt,
      channel: it.source,
      title: titleFor(it),
      actorUserId: (data.actorUserId as string | undefined) ?? null,
      entityType,
      entityId,
      payload: it.data,
    };
  });
}

export async function getTransactionAuditDetail(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  transaction: unknown;
  versionCounts: { buyer: number; vehicle: number; financials: number };
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      governingAgreement: true,
      buyer: { include: { versions: true } },
      vehicle: { include: { versions: true } },
      financials: { include: { versions: true } },
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  return {
    transaction: tx,
    versionCounts: {
      buyer: tx.buyer?.versions.length ?? 0,
      vehicle: tx.vehicle?.versions.length ?? 0,
      financials: tx.financials?.versions.length ?? 0,
    },
  };
}

export async function getDocumentAuditDetail(input: {
  orgId: string;
  documentId: string;
}): Promise<{ document: unknown; auditTrail: unknown[] }> {
  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, transaction: { orgId: input.orgId } },
    include: {
      versions: { orderBy: { version: "desc" } },
      transaction: { select: { id: true, publicId: true } },
    },
  });
  if (!doc) throw new HttpError(404, "Document not found", "NOT_FOUND");

  const auditTrail = await prisma.auditEvent.findMany({
    where: {
      organizationId: input.orgId,
      OR: [
        { entityId: doc.id },
        { resourceId: doc.id },
        { resource: "Document", resourceId: doc.id },
        { transactionId: doc.transactionId },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });

  return { document: doc, auditTrail };
}

export async function getPackageAuditDetail(input: {
  orgId: string;
  packageJobId: string;
}): Promise<{ job: unknown }> {
  const job = await prisma.packageJob.findFirst({
    where: { id: input.packageJobId, transaction: { orgId: input.orgId } },
    include: {
      transaction: { select: { id: true, publicId: true } },
      generatedPackages: true,
    },
  });
  if (!job) throw new HttpError(404, "Package job not found", "NOT_FOUND");
  return { job };
}

export function encodeAuditCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), id }),
    "utf-8",
  )
    .toString("base64url")
    .replace(/=+$/, "");
}

export function decodeAuditCursor(raw?: string): { t: string; id: string } | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    ) as { t: string; id: string };
    if (!j.t || !j.id) return null;
    return j;
  } catch {
    return null;
  }
}

export async function searchAuditEvents(input: {
  orgId: string;
  transactionId?: string;
  eventTypes?: string[];
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string;
}): Promise<{ items: unknown[]; nextCursor: string | null }> {
  const take = Math.min(input.limit, 200);
  const cur = decodeAuditCursor(input.cursor);
  const cursorKey = cur
    ? `${cur.t}\u0000${cur.id}`
    : null;

  const rows = await prisma.auditEvent.findMany({
    where: {
      organizationId: input.orgId,
      ...(input.transactionId ? { transactionId: input.transactionId } : {}),
      ...(input.eventTypes?.length
        ? { eventType: { in: input.eventTypes } }
        : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.from ? { createdAt: { gte: input.from } } : {}),
      ...(input.to ? { createdAt: { lte: input.to } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });

  const key = (r: { createdAt: Date; id: string }) =>
    `${r.createdAt.toISOString()}\u0000${r.id}`;

  let filtered = rows;
  if (cursorKey) {
    filtered = rows.filter((r) => key(r).localeCompare(cursorKey) < 0);
  }

  const page = filtered.slice(0, take);
  const last = page[page.length - 1];
  const nextCursor =
    page.length === take && last ? encodeAuditCursor(last.createdAt, last.id) : null;

  return { items: page, nextCursor };
}

export async function getNormalizedTransactionTimeline(input: {
  orgId: string;
  transactionId: string;
  types?: string;
  limit: number;
  cursor?: string;
}): Promise<{ entries: NormalizedTimelineEntry[]; nextCursor: string | null }> {
  const raw = await getTransactionTimeline(input);
  return {
    entries: normalizeTimelineItems(raw.items),
    nextCursor: raw.nextCursor,
  };
}
