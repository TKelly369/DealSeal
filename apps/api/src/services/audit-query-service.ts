import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

export const timelineSources = ["state", "audit", "document", "package"] as const;
export type TimelineSource = (typeof timelineSources)[number];

export type TimelineItem = {
  source: TimelineSource;
  id: string;
  createdAt: string;
  data: unknown;
};

function parseTypes(raw?: string): Set<TimelineSource> {
  if (!raw || raw.trim() === "") {
    return new Set(timelineSources);
  }
  const parts = raw.split(",").map((s) => s.trim().toLowerCase());
  const allowed = new Set<TimelineSource>();
  for (const p of parts) {
    if ((timelineSources as readonly string[]).includes(p)) {
      allowed.add(p as TimelineSource);
    }
  }
  if (allowed.size === 0) return new Set(timelineSources);
  return allowed;
}

function sortKey(it: TimelineItem): string {
  return `${it.createdAt}\u0000${it.source}\u0000${it.id}`;
}

function encodeCursor(it: TimelineItem): string {
  return Buffer.from(
    JSON.stringify({
      t: it.createdAt,
      source: it.source,
      id: it.id,
    }),
    "utf-8",
  )
    .toString("base64url")
    .replace(/=+$/, "");
}

export function decodeTimelineCursor(
  raw?: string,
): { t: string; source: TimelineSource; id: string } | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    ) as { t: string; source: TimelineSource; id: string };
    if (!json.t || !json.source || !json.id) return null;
    return json;
  } catch {
    return null;
  }
}

function cmpDesc(a: TimelineItem, b: TimelineItem): number {
  return sortKey(b).localeCompare(sortKey(a));
}

/**
 * Read-only merged timeline. Per-source cap avoids unbounded memory; use narrower `types` in production.
 */
export async function getTransactionTimeline(input: {
  orgId: string;
  transactionId: string;
  types?: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: TimelineItem[]; nextCursor: string | null }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");

  const types = parseTypes(input.types);
  const perSource = Math.min(200, Math.max(input.limit * 4, input.limit));
  const decoded = decodeTimelineCursor(input.cursor);
  const cursorKey = decoded
    ? `${decoded.t}\u0000${decoded.source}\u0000${decoded.id}`
    : null;

  const items: TimelineItem[] = [];

  if (types.has("state")) {
    const rows = await prisma.stateTransitionLog.findMany({
      where: { transactionId: input.transactionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: perSource,
    });
    for (const r of rows) {
      items.push({
        source: "state",
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        data: {
          transactionId: input.transactionId,
          fromState: r.fromState,
          toState: r.toState,
          reason: r.reason,
          actorUserId: r.actorUserId,
          metadataJson: r.metadataJson,
        },
      });
    }
  }

  if (types.has("audit")) {
    const rows = await prisma.auditEvent.findMany({
      where: { transactionId: input.transactionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: perSource,
    });
    for (const r of rows) {
      items.push({
        source: "audit",
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        data: {
          eventType: r.eventType,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          resource: r.resource,
          resourceId: r.resourceId,
          actorUserId: r.actorUserId,
          payloadJson: r.payloadJson,
        },
      });
    }
  }

  if (types.has("document")) {
    const docs = await prisma.document.findMany({
      where: { transactionId: input.transactionId },
      select: { id: true },
    });
    const docIds = docs.map((d) => d.id);
    if (docIds.length > 0) {
      const vers = await prisma.documentVersion.findMany({
        where: { documentId: { in: docIds } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: perSource,
        include: { document: true },
      });
      for (const v of vers) {
        items.push({
          source: "document",
          id: v.id,
          createdAt: v.createdAt.toISOString(),
          data: {
            documentId: v.documentId,
            documentType: v.document.type,
            version: v.version,
            storageKey: v.storageKey,
            sha256: v.sha256,
            byteSize: v.byteSize.toString(),
            isImmutable: v.isImmutable,
          },
        });
      }
    }
  }

  if (types.has("package")) {
    const jobs = await prisma.packageJob.findMany({
      where: { transactionId: input.transactionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: perSource,
      include: { generatedPackages: true },
    });
    for (const j of jobs) {
      items.push({
        source: "package",
        id: j.id,
        createdAt: j.createdAt.toISOString(),
        data: {
          status: j.status,
          formats: j.formats,
          templateKey: j.templateKey,
          outputKeys: j.outputKeys,
          manifestStorageKey: j.manifestStorageKey,
          bundleSha256: j.bundleSha256,
          error: j.error,
          completedAt: j.completedAt?.toISOString() ?? null,
          generatedPackages: j.generatedPackages.map((a) => ({
            id: a.id,
            format: a.format,
            storageKey: a.storageKey,
            sha256: a.sha256,
            byteSize: a.byteSize.toString(),
          })),
        },
      });
    }
  }

  items.sort(cmpDesc);

  let filtered = items;
  if (cursorKey) {
    filtered = items.filter((it) => sortKey(it).localeCompare(cursorKey) < 0);
  }

  const page = filtered.slice(0, input.limit);
  const last = page[page.length - 1];
  const nextCursor =
    page.length === input.limit && last ? encodeCursor(last) : null;

  return { items: page, nextCursor };
}
