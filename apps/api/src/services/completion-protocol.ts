import type { CompletionTask, Prisma, TransactionState, UserRole } from "@prisma/client";
import { CompletionTaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";

type Seed = {
  key: string;
  title: string;
  description: string;
  taskType: string;
  source: string;
  isBlocker: boolean;
  assigneeRole: UserRole;
  priority: number;
  dependsOnKeys: string[];
};

const STATUS_ORDER: TransactionState[] = [
  "DRAFT",
  "RED",
  "INVALID",
  "YELLOW",
  "CONDITIONAL",
  "GREEN_STAGE_1",
  "APPROVED",
  "EXECUTED_PENDING_VERIFICATION",
  "EXECUTED",
  "LOCKED",
  "POST_FUNDING_PENDING",
  "COMPLETED",
  "GREEN_STAGE_2",
  "DISCREPANCY_RESTRICTED",
  "HOLD",
  "ARCHIVED",
  "PURGED",
];

function priorityOfState(state: TransactionState): number {
  const i = STATUS_ORDER.indexOf(state);
  return i >= 0 ? i : 0;
}

function seedsFromState(state: TransactionState): Seed[] {
  const out: Seed[] = [];
  if (["YELLOW", "CONDITIONAL", "RED", "INVALID"].includes(state)) {
    out.push({
      key: "state:remediate_conditions",
      title: "Satisfy conditional requirements",
      description: "Address outstanding conditions before first green approval.",
      taskType: "REVIEW",
      source: "STATE",
      isBlocker: true,
      assigneeRole: "DEALER_USER",
      priority: 10 + priorityOfState(state),
      dependsOnKeys: [],
    });
  }
  if (["GREEN_STAGE_1", "APPROVED", "EXECUTED", "EXECUTED_PENDING_VERIFICATION"].includes(state)) {
    out.push({
      key: "state:executed_file_verification",
      title: "Verify executed file package",
      description: "Confirm executed contract and authority packet meet program standards.",
      taskType: "REVIEW",
      source: "STATE",
      isBlocker: true,
      assigneeRole: "COMPLIANCE_OFFICER",
      priority: 20,
      dependsOnKeys: [],
    });
  }
  if (["POST_FUNDING_PENDING", "LOCKED", "COMPLETED", "GREEN_STAGE_2"].includes(state)) {
    out.push({
      key: "seal:post_funding_sweep",
      title: "Post-funding open items",
      description: "Clear any lender/post-funding obligations.",
      taskType: "OPS",
      source: "SEAL",
      isBlocker: false,
      assigneeRole: "FINANCE_MANAGER",
      priority: 5,
      dependsOnKeys: [],
    });
  }
  return out;
}

function seedsFromPostFunding(
  items: { kind: string; description: string; id: string }[],
): Seed[] {
  return items
    .filter((p) => p.description)
    .map((p) => ({
      key: `pf:${p.kind}:${p.id.slice(0, 8)}`,
      title: `Post-funding: ${p.kind}`,
      description: p.description,
      taskType: "POST_FUNDING",
      source: "POST_FUNDING",
      isBlocker: true,
      assigneeRole: "FINANCE_MANAGER" as UserRole,
      priority: 40,
      dependsOnKeys: [] as string[],
    }));
}

export async function rebuildCompletionProtocol(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
}): Promise<{ created: number }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { postFundingItems: true, discrepancies: { where: { status: { in: ["OPEN", "ASSIGNED"] } } } },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");

  const seeds: Seed[] = [
    ...seedsFromState(tx.state),
    ...seedsFromPostFunding(
      tx.postFundingItems.map((p) => ({
        id: p.id,
        kind: p.kind,
        description: p.description,
      })),
    ),
  ];

  for (const d of tx.discrepancies) {
    seeds.push({
      key: `disc:${d.id}`,
      title: `Discrepancy: ${d.code}`,
      description: d.message,
      taskType: "REVIEW",
      source: "DISCREPANCY",
      isBlocker: true,
      assigneeRole: "COMPLIANCE_OFFICER",
      priority: 30,
      dependsOnKeys: [],
    });
  }

  const latestRow = await prisma.lenderRuleEvaluation.findFirst({
    where: { transactionId: tx.id, orgId: input.orgId },
    orderBy: { evaluatedAt: "desc" },
    select: { runId: true, evaluatedAt: true },
  });
  const runRows = latestRow
    ? await prisma.lenderRuleEvaluation.findMany({
        where: { runId: latestRow.runId, orgId: input.orgId, transactionId: tx.id },
        orderBy: { evaluatedAt: "asc" },
      })
    : [];
  for (const row of runRows) {
    if (row.lineOutcome === "FAIL" || row.lineOutcome === "WARN") {
      seeds.push({
        key: `lender:${row.id.slice(0, 12)}`,
        title: `Lender: ${row.message.slice(0, 120)}`,
        description: row.message,
        taskType: "LENDER",
        source: "LENDER_RULE",
        isBlocker: row.lineOutcome === "FAIL" && !row.isOverrideable,
        assigneeRole: "COMPLIANCE_OFFICER",
        priority: 50,
        dependsOnKeys: [],
      });
    }
  }

  const notAccepted = await prisma.document.findMany({
    where: { transactionId: tx.id, ingestStatus: { not: "ACCEPTED" } },
  });
  for (const d of notAccepted) {
    seeds.push({
      key: `doc:${d.id}:accept`,
      title: `Document ${d.type} must be accepted`,
      description: `Ingest status ${d.ingestStatus} — must reach ACCEPTED.`,
      taskType: "DOCUMENT",
      source: "DOCUMENT",
      isBlocker: d.ingestStatus === "REJECTED",
      assigneeRole: "DEALER_USER",
      priority: 35,
      dependsOnKeys: [],
    });
  }

  const deterministic = seeds.sort(
    (a, b) => a.key.localeCompare(b.key) || a.priority - b.priority,
  );

  await prisma.$transaction(async (db) => {
    await db.completionTask.deleteMany({ where: { transactionId: tx.id } });
    for (const s of deterministic) {
      await db.completionTask.create({
        data: {
          transactionId: tx.id,
          key: s.key,
          title: s.title,
          description: s.description,
          taskType: s.taskType,
          source: s.source,
          isBlocker: s.isBlocker,
          priority: s.priority,
          assigneeRole: s.assigneeRole,
          dependsOnKeys: s.dependsOnKeys,
          status: "PENDING",
          metadataJson: { deterministic: true, priority: s.priority } as Prisma.JsonObject,
        },
      });
    }
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "COMPLETION_PROTOCOL_REBUILD",
    action: "COMPLETION_PROTOCOL_REBUILD",
    entityType: "Transaction",
    entityId: tx.id,
    resource: "Transaction",
    resourceId: tx.id,
    payload: { created: deterministic.length },
  });

  return { created: deterministic.length };
}

export async function getCompletionProtocolView(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  total: number;
  blockers: number;
  tasks: CompletionTask[];
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const tasks = await prisma.completionTask.findMany({
    where: { transactionId: tx.id },
    orderBy: [{ priority: "asc" as const }, { key: "asc" as const }],
  });
  const blockers = tasks.filter((t) => t.isBlocker && t.status !== "DONE").length;
  return { total: tasks.length, blockers, tasks };
}

export async function patchCompletionTask(input: {
  orgId: string;
  taskId: string;
  body: { status: CompletionTaskStatus; note?: string };
  actorUserId: string;
}): Promise<unknown> {
  const t = await prisma.completionTask.findFirst({
    where: { id: input.taskId, transaction: { orgId: input.orgId } },
  });
  if (!t) throw new HttpError(404, "Task not found", "NOT_FOUND");
  const updated = await prisma.completionTask.update({
    where: { id: t.id },
    data: {
      status: input.body.status,
      metadataJson: {
        ...(t.metadataJson as object),
        lastEditBy: input.actorUserId,
        note: input.body.note,
      } as Prisma.JsonObject,
    },
  });
  await recordAudit({
    orgId: input.orgId,
    transactionId: t.transactionId,
    actorUserId: input.actorUserId,
    eventType: "COMPLETION_TASK_UPDATE",
    action: "COMPLETION_TASK_UPDATE",
    entityType: "CompletionTask",
    entityId: t.id,
    resource: "CompletionTask",
    resourceId: t.id,
    payload: { status: input.body.status },
  });
  return updated;
}

/** @deprecated use rebuildCompletionProtocol — kept for backward imports */
export async function materializeCompletionTasks(transactionId: string): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId },
    include: { org: true },
  });
  if (!tx) return;
  const orgId = tx.orgId;
  const anyUser = await prisma.membership.findFirst({
    where: { orgId, roles: { hasSome: ["ADMIN", "DEALER_USER", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"] } },
  });
  const actor = anyUser?.userId;
  if (!actor) return;
  await rebuildCompletionProtocol({
    orgId,
    transactionId,
    actorUserId: actor,
  });
}
