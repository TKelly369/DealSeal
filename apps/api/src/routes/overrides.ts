import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "../services/audit-service.js";

const createBody = z.object({
  transactionId: z.string().uuid(),
  ruleId: z.string().optional(),
  justification: z.string().min(10),
});

const decideBody = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export function createOverridesRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));

  r.post(
    "/",
    requireRoles("FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = createBody.parse(req.body);
      const tx = await prisma.transaction.findFirst({
        where: { id: body.transactionId, orgId },
      });
      if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");

      const o = await prisma.overrideRecord.create({
        data: {
          transactionId: body.transactionId,
          ruleId: body.ruleId,
          justification: body.justification,
          requesterId: req.auth!.sub,
        },
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "OVERRIDE_REQUEST",
        resource: "OverrideRecord",
        resourceId: o.id,
      });
      res.status(201).json(o);
    }),
  );

  r.post(
    "/:id/decide",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = decideBody.parse(req.body);
      const existing = await prisma.overrideRecord.findFirst({
        where: { id: req.params.id },
        include: { transaction: true },
      });
      if (!existing || existing.transaction.orgId !== orgId) {
        throw new HttpError(404, "Not found", "NOT_FOUND");
      }
      const updated = await prisma.overrideRecord.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          approverId: req.auth!.sub,
          decidedAt: new Date(),
        },
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "OVERRIDE_DECIDE",
        resource: "OverrideRecord",
        resourceId: updated.id,
        payload: { status: body.status },
      });
      res.json(updated);
    }),
  );

  return r;
}
