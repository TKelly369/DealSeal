import { Router } from "express";
import type { UserRole } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { transitionTransaction } from "../services/state-engine.js";
import { recordAudit } from "../services/audit-service.js";

export function createApprovalsRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));

  r.post(
    "/transactions/:id/approve",
    requireRoles("COMPLIANCE_OFFICER", "FINANCE_MANAGER", "ADMIN"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      await transitionTransaction({
        orgId,
        transactionId: req.params.id,
        toState: "GREEN_STAGE_1",
        actorUserId: req.auth!.sub,
        roles: req.auth!.roles as UserRole[],
        reason: "Approval flow",
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "APPROVAL_GRANTED",
        resource: "Transaction",
        resourceId: req.params.id,
      });
      res.json({ ok: true });
    }),
  );

  return r;
}
