import { Router } from "express";
import { z } from "zod";
import { TransactionState, type UserRole } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { transitionTransaction } from "../services/state-engine.js";
import { onDealStateSettled } from "../services/state-hooks.js";

const bodySchema = z.object({
  toState: z.nativeEnum(TransactionState),
  reason: z.string().optional(),
});

export function createStateRouter(env: Env): Router {
  const r = Router();
  const auth = createAuthMiddleware(env);
  r.use(auth);

  r.post(
    "/transactions/:id/transition",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const parsed = bodySchema.parse(req.body);
      await transitionTransaction({
        orgId,
        transactionId: req.params.id,
        toState: parsed.toState,
        actorUserId: req.auth!.sub,
        roles: req.auth!.roles as UserRole[],
        reason: parsed.reason,
      });

      await onDealStateSettled({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        toState: parsed.toState,
      });

      res.json({ ok: true });
    }),
  );

  return r;
}
