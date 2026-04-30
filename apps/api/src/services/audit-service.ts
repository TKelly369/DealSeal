import type { Prisma } from "@prisma/client";
import { computeAuditChainHash } from "@dealseal/shared/audit-hash-chain";
import { prisma } from "../lib/prisma.js";

function optionalJsonField(value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value;
}

function advisoryLockKey(): bigint {
  const raw = process.env.AUDIT_CHAIN_LOCK_KEY;
  if (raw !== undefined && raw !== "") {
    try {
      return BigInt(raw);
    } catch {
      /* fall through */
    }
  }
  return BigInt(88472291);
}

export async function recordAudit(input: {
  orgId?: string | null;
  organizationId?: string | null;
  transactionId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  authMethod?: string | null;
  /** Primary classification for search/filters (defaults to `action`). */
  eventType?: string | null;
  action: string;
  /** Entity classification (defaults to `resource`). */
  entityType?: string | null;
  entityId?: string | null;
  resource: string;
  resourceId?: string | null;
  payload?: Prisma.InputJsonValue;
  deltaBefore?: Prisma.InputJsonValue | null;
  deltaAfter?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const eventType = input.eventType ?? input.action;
  const entityType = input.entityType ?? input.resource;
  const entityId = input.entityId ?? input.resourceId ?? undefined;
  const organizationId = input.organizationId ?? input.orgId ?? undefined;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey()})`;

    const last = await tx.auditEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { chainHash: true },
    });

    const previousChainHash = last?.chainHash ?? "";
    const createdAt = new Date();
    const timestampIso = createdAt.toISOString();

    const eventBlob: Record<string, unknown> = {
      organizationId: organizationId ?? null,
      transactionId: input.transactionId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      authMethod: input.authMethod ?? null,
      action: input.action,
      eventType,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      payloadJson: input.payload ?? {},
      deltaBefore: input.deltaBefore ?? null,
      deltaAfter: input.deltaAfter ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    };

    const chainHash = computeAuditChainHash({
      previousChainHash,
      timestampIso,
      eventBlob,
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        transactionId: input.transactionId ?? undefined,
        actorUserId: input.actorUserId ?? undefined,
        actorRole: input.actorRole ?? undefined,
        authMethod: input.authMethod ?? undefined,
        eventType,
        action: input.action,
        entityType: entityType ?? undefined,
        entityId,
        resource: input.resource,
        resourceId: input.resourceId ?? undefined,
        payloadJson: input.payload ?? {},
        deltaBefore: optionalJsonField(input.deltaBefore),
        deltaAfter: optionalJsonField(input.deltaAfter),
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
        previousChainHash: last?.chainHash ?? undefined,
        chainHash,
        createdAt,
      },
    });
  });
}
