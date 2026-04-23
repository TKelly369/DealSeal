import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { processInboundIntegrationWebhook } from "../services/inbound-webhook-service.js";
import { dispatchTestOutbound } from "../services/webhook-dispatcher.js";
import { HttpError } from "../lib/http-error.js";

const outboundTestBody = z.object({ configId: z.string().uuid() });

export function createWebhooksPublicHandler() {
  return (req: Request, res: Response): void => {
    void (async () => {
      const raw = req.body as Buffer;
      const sig = req.headers["x-dealseal-signature"];
      const out = await processInboundIntegrationWebhook({
        rawBody: raw.toString("utf-8"),
        receivedSig: typeof sig === "string" ? sig : undefined,
      });
      res.status(201).json(out);
    })().catch((e) => {
      if (e instanceof HttpError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
      }
      // eslint-disable-next-line no-console
      console.error(e);
      res.status(500).json({ code: "INTERNAL", message: "Error" });
    });
  };
}

export function createOutboundTestRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));
  r.use(requireRoles("ADMIN", "COMPLIANCE_OFFICER"));
  r.post(
    "/outbound/test",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = outboundTestBody.parse(req.body);
      const r0 = await dispatchTestOutbound(orgId, body.configId);
      res.json(r0);
    }),
  );
  return r;
}
