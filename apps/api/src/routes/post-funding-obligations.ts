import { Router } from "express";
import { z } from "zod";
import { PostFundingStatus } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { patchPostFundingObligation } from "../services/post-funding-obligation-service.js";

const patchPfi = z.object({
  status: z.nativeEnum(PostFundingStatus).optional(),
  note: z.string().max(2000).optional(),
});

export function createPostFundingObligationsRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));
  r.use(requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"));

  r.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const body = patchPfi.parse(req.body);
      const u = await patchPostFundingObligation({
        orgId: req.auth!.orgId,
        obligationId: req.params.id,
        actorUserId: req.auth!.sub,
        body: { status: body.status, note: body.note },
      });
      res.json(u);
    }),
  );

  return r;
}
