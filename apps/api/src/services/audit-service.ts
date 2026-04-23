import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function recordAudit(input: {
  orgId?: string | null;
  organizationId?: string | null;
  transactionId?: string | null;
  actorUserId?: string | null;
  /** Primary classification for search/filters (defaults to `action`). */
  eventType?: string | null;
  action: string;
  /** Entity classification (defaults to `resource`). */
  entityType?: string | null;
  entityId?: string | null;
  resource: string;
  resourceId?: string | null;
  payload?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const eventType = input.eventType ?? input.action;
  const entityType = input.entityType ?? input.resource;
  const entityId = input.entityId ?? input.resourceId ?? undefined;
  const organizationId = input.organizationId ?? input.orgId ?? undefined;
  await prisma.auditEvent.create({
    data: {
      organizationId,
      transactionId: input.transactionId ?? undefined,
      actorUserId: input.actorUserId ?? undefined,
      eventType,
      action: input.action,
      entityType: entityType ?? undefined,
      entityId,
      resource: input.resource,
      resourceId: input.resourceId ?? undefined,
      payloadJson: input.payload ?? {},
      ip: input.ip ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
}
