import { randomUUID } from "node:crypto";
import type { Prisma, Rule, RuleEvalOutcome, RuleSeverity } from "@prisma/client";
import { DocumentType, LenderRuleLineOutcome, type LenderProgram, type LenderDocumentRequirement } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { evaluateRuleExpression } from "./rules-revaluation-service.js";
import { recordAudit } from "./audit-service.js";

function txSnapshot(tx: {
  financials: { amountFinanced: unknown; lenderCode: string | null; termMonths: number | null; aprBps: number | null } | null;
}): { transactionId: string; amountFinanced: number | null; lenderCode: string | null; termMonths: number | null; aprBps: number | null } {
  const af = tx.financials?.amountFinanced;
  const num =
    af === null || af === undefined
      ? null
      : typeof af === "object" && af !== null && "toNumber" in af
        ? (af as { toNumber: () => number }).toNumber()
        : Number(af);
  return {
    transactionId: "",
    amountFinanced: Number.isFinite(num) ? num : null,
    lenderCode: tx.financials?.lenderCode ?? null,
    termMonths: tx.financials?.termMonths ?? null,
    aprBps: tx.financials?.aprBps ?? null,
  };
}

function mapOutcome(o: RuleEvalOutcome): { line: LenderRuleLineOutcome } {
  if (o === "FAIL") return { line: "FAIL" };
  if (o === "PASS") return { line: "PASS" };
  return { line: "WARN" };
}

function messageForRule(rule: Rule, o: RuleEvalOutcome, detail: Prisma.JsonValue) {
  return `Rule ${rule.ruleId} → ${o} (${JSON.stringify(detail).slice(0, 200)})`;
}

function evalDocRequirement(
  req: LenderDocumentRequirement & { program: { key: string } },
  hasAccepted: Set<string>,
) {
  const k = `DOC:${req.documentType}:${req.programId}`;
  const ok = !req.required || hasAccepted.has(req.documentType);
  return {
    key: k,
    lineOutcome: (ok ? "PASS" : "FAIL") as LenderRuleLineOutcome,
    severity: "BLOCKING" as RuleSeverity,
    message: ok
      ? `Document type ${req.documentType} present`
      : `Required document type ${req.documentType} is missing or not accepted`,
  };
}

export async function listRunLines(input: { orgId: string; runId: string }) {
  return prisma.lenderRuleEvaluation.findMany({
    where: { orgId: input.orgId, runId: input.runId },
    orderBy: { evaluatedAt: "asc" },
    include: { rule: { select: { ruleId: true, ruleType: true } } },
  });
}

export async function getLatestLenderEvaluation(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  runId: string | null;
  program: LenderProgram | null;
  items: Awaited<ReturnType<typeof listRunLines>>;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const latest = await prisma.lenderRuleEvaluation.findFirst({
    where: { transactionId: input.transactionId, orgId: input.orgId },
    orderBy: { evaluatedAt: "desc" },
  });
  if (!latest) {
    return { runId: null, program: null, items: [] };
  }
  const runId = latest.runId;
  const lines = await listRunLines({ orgId: input.orgId, runId });
  const program = await prisma.lenderProgram.findFirst({
    where: { id: latest.lenderProgramId },
  });
  return { runId, program, items: lines };
}

export async function runLenderEvaluationForTransaction(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  /** Defaults to `transaction.selectedLenderProgramId` or first active program for lender. */
  lenderProgramId?: string;
}): Promise<{
  runId: string;
  summary: { pass: number; fail: number; warn: number };
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { financials: true, documents: { include: { versions: { take: 1, orderBy: { version: "desc" } } } } },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");

  let program: LenderProgram | null = null;
  if (input.lenderProgramId) {
    program = await prisma.lenderProgram.findFirst({
      where: { id: input.lenderProgramId, active: true },
    });
  } else if (tx.selectedLenderProgramId) {
    program = await prisma.lenderProgram.findFirst({
      where: { id: tx.selectedLenderProgramId, active: true },
    });
  } else {
    const code = tx.financials?.lenderCode;
    if (code) {
      const lender = await prisma.lender.findFirst({ where: { code, active: true } });
      if (lender) {
        program = await prisma.lenderProgram.findFirst({
          where: { lenderId: lender.id, active: true },
        });
      }
    }
  }
  if (!program) {
    throw new HttpError(400, "No active lender program could be selected", "NO_LENDER_PROGRAM");
  }

  const inAmountRange =
    (program.minAmountFinanced == null || program.minAmountFinanced === undefined
      ? true
      : Number(tx.financials?.amountFinanced ?? 0) >=
        (program.minAmountFinanced as unknown as number)) &&
    (program.maxAmountFinanced == null || program.maxAmountFinanced === undefined
      ? true
      : Number(tx.financials?.amountFinanced ?? 0) <=
        (program.maxAmountFinanced as unknown as number));
  if (!inAmountRange) {
    throw new HttpError(409, "Financed amount outside program min/max", "AMOUNT_OOB");
  }

  const runId = randomUUID();
  const snap = txSnapshot({
    financials: tx.financials,
  });
  snap.transactionId = tx.id;

  const prRules = await prisma.lenderProgramRule.findMany({
    where: { programId: program.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: { rule: true },
  });

  const acceptedDocTypes = new Set<string>();
  for (const d of tx.documents) {
    const st = d.ingestStatus;
    if (st === "ACCEPTED" || st === "CLASSIFIED") {
      acceptedDocTypes.add(d.type);
    }
  }
  const docReqs = await prisma.lenderDocumentRequirement.findMany({
    where: { programId: program.id },
    include: { program: { select: { key: true } } },
  });

  let pass = 0;
  let fail = 0;
  let warn = 0;
  const toInsert: Prisma.LenderRuleEvaluationCreateManyInput[] = [];

  for (const pr of prRules) {
    const rule: Rule = pr.rule;
    const { outcome, detail } = evaluateRuleExpression(rule, snap);
    const mapped = mapOutcome(outcome);
    if (mapped.line === "PASS") pass += 1;
    else if (mapped.line === "FAIL") fail += 1;
    else warn += 1;
    toInsert.push({
      id: randomUUID(),
      runId,
      orgId: input.orgId,
      transactionId: tx.id,
      lenderProgramId: program.id,
      ruleDbId: rule.id,
      lineOutcome: mapped.line,
      severity: rule.severity,
      isOverrideable: mapped.line === "FAIL" ? rule.overrideFlag : true,
      message: messageForRule(rule, outcome, detail as Prisma.JsonValue),
      detailJson: detail,
      evaluatedAt: new Date(),
    });
  }

  const gateRule =
    prRules[0]?.rule ??
    (await prisma.rule.findFirst({ where: { active: true } }));
  if (docReqs.length > 0 && !gateRule) {
    throw new HttpError(500, "Add at least one active Rule in the catalog to attach program checks", "NO_GATE_RULE");
  }
  for (const req of docReqs) {
    const ev = evalDocRequirement(
      { ...req, program: { key: program.key }, documentType: req.documentType as DocumentType },
      acceptedDocTypes,
    );
    if (ev.lineOutcome === "PASS") pass += 1;
    else if (ev.lineOutcome === "FAIL") fail += 1;
    else warn += 1;
    toInsert.push({
      id: randomUUID(),
      runId,
      orgId: input.orgId,
      transactionId: tx.id,
      lenderProgramId: program.id,
      ruleDbId: gateRule!.id,
      lineOutcome: ev.lineOutcome,
      severity: ev.severity,
      isOverrideable: true,
      message: ev.message,
      detailJson: {
        kind: "DOCUMENT_REQUIREMENT",
        documentType: req.documentType,
        key: ev.key,
      } as Prisma.InputJsonValue,
      evaluatedAt: new Date(),
    });
  }

  await prisma.$transaction(async (db) => {
    if (toInsert.length) {
      await db.lenderRuleEvaluation.createMany({ data: toInsert });
    }
    await db.transaction.update({
      where: { id: tx.id },
      data: { selectedLenderProgramId: program.id },
    });
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "LENDER_EVALUATION_RUN",
    action: "LENDER_EVALUATION_RUN",
    entityType: "LenderRuleEvaluation",
    entityId: runId,
    resource: "LenderRuleEvaluation",
    resourceId: runId,
    payload: { runId, programId: program.id, counts: { pass, fail, warn } },
  });

  return { runId, summary: { pass, fail, warn } };
}
