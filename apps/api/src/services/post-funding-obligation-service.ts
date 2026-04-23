import type { Prisma } from "@prisma/client";
import { PostFundingStatus, PostFundingSeverity, type UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";

const DEFAULT_TEMPLATE: {
  kind: string;
  title: string;
  description: string;
  source: string;
  isBlocker: boolean;
  severity: PostFundingSeverity;
}[] = [
  {
    kind: "TITLE_FILING",
    title: "Title filing / ELT",
    description: "Record title and lender lien as required",
    source: "LENDER",
    isBlocker: true,
    severity: "HIGH",
  },
  {
    kind: "LIEN_PERFECTION",
    title: "Lien perfection check",
    description: "Confirm lien position and filing",
    source: "LENDER",
    isBlocker: true,
    severity: "NORMAL",
  },
  {
    kind: "STIPULATION",
    title: "Stipulation follow-up",
    description: "Complete any funding stipulations",
    source: "RULE",
    isBlocker: false,
    severity: "LOW",
  },
];

export async function listPostFundingObligations(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  items: Awaited<ReturnType<typeof prisma.postFundingItem.findMany>>;
}> {
  const ok = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    select: { id: true },
  });
  if (!ok) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const items = await prisma.postFundingItem.findMany({
    where: { transactionId: input.transactionId },
    orderBy: [{ isBlocker: "desc" }, { dueAt: "asc" }],
  });
  return { items };
}

export async function rebuildPostFundingObligations(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
}): Promise<{ created: number }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { selectedLenderProgram: true },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (
    tx.state !== "LOCKED" &&
    tx.state !== "POST_FUNDING_PENDING" &&
    tx.state !== "COMPLETED" &&
    tx.state !== "GREEN_STAGE_2"
  ) {
    throw new HttpError(409, "Post-funding obligations are built after lock", "STATE", {
      state: tx.state,
    });
  }

  let created = 0;
  for (const row of DEFAULT_TEMPLATE) {
    const key = `pf:${row.kind}:v1`;
    const existing = await prisma.postFundingItem.findFirst({
      where: { transactionId: tx.id, kind: key },
    });
    if (existing) continue;
    await prisma.postFundingItem.create({
      data: {
        transactionId: tx.id,
        kind: key,
        title: row.title,
        description: row.description,
        source: row.source,
        isBlocker: row.isBlocker,
        severity: row.severity,
        status: PostFundingStatus.PENDING,
        dueAt: new Date(Date.now() + 7 * 86400_000),
        assigneeRole: "COMPLIANCE_OFFICER" as UserRole,
        metadataJson: { template: row.kind },
      },
    });
    created += 1;
  }

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "POST_FUNDING_REBUILD",
    action: "POST_FUNDING_REBUILD",
    resource: "PostFunding",
    resourceId: tx.id,
    payload: { created },
  });

  return { created };
}

export async function patchPostFundingObligation(input: {
  orgId: string;
  obligationId: string;
  actorUserId: string;
  body: { status?: PostFundingStatus; note?: string };
}): Promise<unknown> {
  const row = await prisma.postFundingItem.findFirst({
    where: { id: input.obligationId, transaction: { orgId: input.orgId } },
  });
  if (!row) throw new HttpError(404, "Obligation not found", "NOT_FOUND");
  const data: {
    status?: PostFundingStatus;
    satisfiedAt?: Date | null;
    completedByUserId?: string;
    metadataJson?: Prisma.InputJsonValue;
  } = {};
  if (input.body.status) {
    data.status = input.body.status;
    if (input.body.status === "SATISFIED" || input.body.status === "WAIVED") {
      data.satisfiedAt = new Date();
      data.completedByUserId = input.actorUserId;
    }
  }
  if (input.body.note) {
    const prev = (row.metadataJson && typeof row.metadataJson === "object"
      ? row.metadataJson
      : {}) as Prisma.JsonObject;
    data.metadataJson = { ...prev, note: input.body.note } as Prisma.InputJsonValue;
  }
  const updated = await prisma.postFundingItem.update({
    where: { id: row.id },
    data,
  });
  await recordAudit({
    orgId: input.orgId,
    transactionId: row.transactionId,
    actorUserId: input.actorUserId,
    eventType: "POST_FUNDING_UPDATE",
    action: "POST_FUNDING_UPDATE",
    entityType: "PostFundingItem",
    entityId: row.id,
    resource: "PostFundingItem",
    resourceId: row.id,
    payload: { status: data.status },
  });
  return updated;
}

export function isOverdue(item: { dueAt: Date | null; status: PostFundingStatus }): boolean {
  if (!item.dueAt) return false;
  if (item.status === "SATISFIED" || item.status === "WAIVED") return false;
  return item.dueAt.getTime() < Date.now();
}
