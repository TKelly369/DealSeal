import { Router } from "express";
import { z } from "zod";
import {
  RuleSeverity,
  RuleType,
  RuleEvalOutcome,
} from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "../services/audit-service.js";

const createRule = z.object({
  ruleId: z.string().min(1),
  ruleType: z.nativeEnum(RuleType),
  conditionExpression: z.string().min(1),
  severity: z.nativeEnum(RuleSeverity),
  lenderCode: z.string().optional(),
  jurisdiction: z.string().optional(),
  overrideFlag: z.boolean().optional(),
});

const evalBody = z.object({
  transactionId: z.string().uuid(),
  outcome: z.nativeEnum(RuleEvalOutcome),
  detail: z.record(z.string(), z.any()).optional(),
});

export function createRulesRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));

  r.get(
    "/",
    asyncHandler(async (_req, res) => {
      const rules = await prisma.rule.findMany({
        where: { active: true },
        orderBy: { ruleId: "asc" },
      });
      res.json({ items: rules });
    }),
  );

  r.patch(
    "/:id",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const body = z
        .object({ active: z.boolean().optional(), overrideFlag: z.boolean().optional() })
        .parse(req.body);
      const data: { active?: boolean; overrideFlag?: boolean } = {};
      if (body.active !== undefined) data.active = body.active;
      if (body.overrideFlag !== undefined) data.overrideFlag = body.overrideFlag;
      const rule = await prisma.rule.update({
        where: { id: req.params.id },
        data,
      });
      await recordAudit({
        orgId: req.auth!.orgId,
        actorUserId: req.auth!.sub,
        eventType: "RULE_UPDATE",
        action: "RULE_UPDATE",
        entityType: "Rule",
        entityId: rule.id,
        resource: "Rule",
        resourceId: rule.id,
        payload: body,
      });
      res.json(rule);
    }),
  );

  r.post(
    "/",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const body = createRule.parse(req.body);
      const rule = await prisma.rule.create({
        data: {
          ruleId: body.ruleId,
          ruleType: body.ruleType,
          conditionExpression: body.conditionExpression,
          severity: body.severity,
          lenderCode: body.lenderCode,
          jurisdiction: body.jurisdiction,
          overrideFlag: body.overrideFlag ?? false,
        },
      });
      await recordAudit({
        orgId: req.auth!.orgId,
        actorUserId: req.auth!.sub,
        eventType: "RULE_CREATE",
        action: "RULE_CREATE",
        entityType: "Rule",
        entityId: rule.id,
        resource: "Rule",
        resourceId: rule.id,
      });
      res.status(201).json(rule);
    }),
  );

  r.post(
    "/:ruleDbId/evaluations",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = evalBody.parse(req.body);
      const tx = await prisma.transaction.findFirst({
        where: { id: body.transactionId, orgId },
      });
      if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
      const rule = await prisma.rule.findUnique({
        where: { id: req.params.ruleDbId },
      });
      if (!rule) throw new HttpError(404, "Rule not found", "NOT_FOUND");

      const ev = await prisma.ruleEvaluation.create({
        data: {
          transactionId: body.transactionId,
          ruleDbId: rule.id,
          outcome: body.outcome,
          detailJson: body.detail ?? {},
        },
      });
      if (body.outcome === "FAIL") {
        await prisma.discrepancy.create({
          data: {
            transactionId: body.transactionId,
            code: `RULE_${rule.ruleId}`,
            message: `Rule evaluation failed: ${rule.ruleId}`,
            status: "OPEN",
          },
        });
      }
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "RULE_EVAL",
        resource: "RuleEvaluation",
        resourceId: ev.id,
      });
      res.status(201).json(ev);
    }),
  );

  return r;
}
