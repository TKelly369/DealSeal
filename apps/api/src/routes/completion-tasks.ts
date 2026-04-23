import { Router } from "express";
import { z } from "zod";
import { CompletionTaskStatus } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { patchCompletionTask } from "../services/completion-protocol.js";

const body = z.object({
  status: z.nativeEnum(CompletionTaskStatus),
  note: z.string().max(2000).optional(),
});

export function createCompletionTasksRouter(_env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(_env));
  r.use(
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
  );

  r.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const b = body.parse(req.body);
      const out = await patchCompletionTask({
        orgId: req.auth!.orgId,
        taskId: req.params.id,
        body: b,
        actorUserId: req.auth!.sub,
      });
      res.json(out);
    }),
  );

  return r;
}
