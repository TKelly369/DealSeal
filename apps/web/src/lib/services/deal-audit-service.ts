import type { Prisma } from "@/generated/prisma";
import { computeAuditChainHash } from "@dealseal/shared/audit-hash-chain";
import { prisma } from "@/lib/db";

const DEAL_AUDIT_LOCK = BigInt(99187234);

function optionalJsonField(value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value;
}

export async function recordDealAuditEvent(input: {
  dealId?: string | null;
  workspaceId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  authMethod?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  deltaBefore?: Prisma.InputJsonValue | null;
  deltaAfter?: Prisma.InputJsonValue | null;
  payload?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DEAL_AUDIT_LOCK})`;

    const last = await tx.dealAuditEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { chainHash: true },
    });

    const previousChainHash = last?.chainHash ?? "";
    const createdAt = new Date();
    const timestampIso = createdAt.toISOString();

    const eventBlob: Record<string, unknown> = {
      dealId: input.dealId ?? null,
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      authMethod: input.authMethod ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      deltaBefore: input.deltaBefore ?? null,
      deltaAfter: input.deltaAfter ?? null,
      payloadJson: input.payload ?? {},
      ipAddress: input.ipAddress ?? null,
    };

    const chainHash = computeAuditChainHash({
      previousChainHash,
      timestampIso,
      eventBlob,
    });

    await tx.dealAuditEvent.create({
      data: {
        dealId: input.dealId ?? undefined,
        workspaceId: input.workspaceId ?? undefined,
        actorUserId: input.actorUserId ?? undefined,
        actorRole: input.actorRole ?? undefined,
        authMethod: input.authMethod ?? undefined,
        action: input.action,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        deltaBefore: optionalJsonField(input.deltaBefore),
        deltaAfter: optionalJsonField(input.deltaAfter),
        payloadJson: input.payload ?? {},
        ipAddress: input.ipAddress ?? undefined,
        previousChainHash: last?.chainHash ?? undefined,
        chainHash,
        createdAt,
      },
    });
  });
}
