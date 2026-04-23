import type { Prisma, Rule, RuleEvalOutcome } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type TransactionRuleSnapshot = {
  transactionId: string;
  amountFinanced: number | null;
  lenderCode: string | null;
  termMonths: number | null;
  aprBps: number | null;
};

function parseSnapshot(tx: {
  id: string;
  financials: { amountFinanced: unknown; lenderCode: string | null; termMonths: number | null; aprBps: number | null } | null;
}): TransactionRuleSnapshot {
  const af = tx.financials?.amountFinanced;
  const num =
    af === null || af === undefined
      ? null
      : typeof af === "object" && af !== null && "toNumber" in af
        ? (af as { toNumber: () => number }).toNumber()
        : Number(af);
  return {
    transactionId: tx.id,
    amountFinanced: Number.isFinite(num) ? num : null,
    lenderCode: tx.financials?.lenderCode ?? null,
    termMonths: tx.financials?.termMonths ?? null,
    aprBps: tx.financials?.aprBps ?? null,
  };
}

/**
 * Deterministic, safe evaluation of `Rule.conditionExpression`.
 * Supports JSON DSL only; unknown text → CONDITIONAL (does not auto-fail).
 */
export function evaluateRuleExpression(
  rule: Rule,
  snap: TransactionRuleSnapshot,
): { outcome: RuleEvalOutcome; detail: Prisma.InputJsonValue } {
  const raw = rule.conditionExpression.trim();
  if (!raw.startsWith("{")) {
    return {
      outcome: "CONDITIONAL",
      detail: { reason: "UNPARSED_EXPRESSION", preview: raw.slice(0, 200) },
    };
  }
  try {
    const spec = JSON.parse(raw) as Record<string, unknown>;
    if (spec.kind === "max_finance" && typeof spec.maxAmount === "number") {
      if (snap.amountFinanced === null) {
        return {
          outcome: "CONDITIONAL",
          detail: { ruleId: rule.ruleId, reason: "MISSING_AMOUNT" },
        };
      }
      if (snap.amountFinanced > spec.maxAmount) {
        return {
          outcome: "FAIL",
          detail: {
            ruleId: rule.ruleId,
            amountFinanced: snap.amountFinanced,
            maxAmount: spec.maxAmount,
          },
        };
      }
      return { outcome: "PASS", detail: { ruleId: rule.ruleId } };
    }
    if (spec.kind === "lender_required" && typeof spec.code === "string") {
      if (!snap.lenderCode) {
        return {
          outcome: "FAIL",
          detail: { ruleId: rule.ruleId, reason: "LENDER_REQUIRED" },
        };
      }
      if (snap.lenderCode !== spec.code) {
        return {
          outcome: "CONDITIONAL",
          detail: {
            ruleId: rule.ruleId,
            reason: "LENDER_MISMATCH",
            expected: spec.code,
            actual: snap.lenderCode,
          },
        };
      }
      return { outcome: "PASS", detail: { ruleId: rule.ruleId } };
    }
    return {
      outcome: "CONDITIONAL",
      detail: {
        ruleId: rule.ruleId,
        reason: "UNKNOWN_SPEC",
        spec: spec as Prisma.InputJsonValue,
      },
    };
  } catch (e) {
    return {
      outcome: "CONDITIONAL",
      detail: {
        ruleId: rule.ruleId,
        reason: "INVALID_JSON",
        message: String(e),
      } as Prisma.InputJsonValue,
    };
  }
}

/** Runs all active rules; inserts RuleEvaluation rows; opens discrepancies on FAIL. */
export async function runFullRuleReevaluation(input: {
  transactionId: string;
  orgId: string;
}): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { financials: true },
  });
  if (!tx) return;

  const snap = parseSnapshot(tx);
  const rules = await prisma.rule.findMany({ where: { active: true } });

  await prisma.$transaction(async (db) => {
    for (const rule of rules) {
      const { outcome, detail } = evaluateRuleExpression(rule, snap);
      await db.ruleEvaluation.create({
        data: {
          transactionId: tx.id,
          ruleDbId: rule.id,
          outcome,
          detailJson: detail,
        },
      });
      if (outcome === "FAIL") {
        const code = `RULE_${rule.ruleId}`;
        const existing = await db.discrepancy.findFirst({
          where: { transactionId: tx.id, code, status: "OPEN" },
        });
        if (!existing) {
          await db.discrepancy.create({
            data: {
              transactionId: tx.id,
              code,
              message: `Rule evaluation failed: ${rule.ruleId}`,
              status: "OPEN",
            },
          });
        }
      }
    }
    await db.transaction.update({
      where: { id: tx.id },
      data: { validationVersion: { increment: 1 } },
    });
  });
}
