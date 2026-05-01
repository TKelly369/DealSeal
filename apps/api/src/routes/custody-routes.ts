import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Command } from "@dealseal/custody-ledger";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { asyncHandler } from "../util/async-handler.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { buildCustodyRequestContext } from "../middleware/custody-request-context.js";
import type { Env } from "../config/env.js";
import type { CustodyRuntime } from "../services/custody/custody-factory.js";
import { LENDER_VIEWED_DEAL_COMMAND } from "../services/custody/default-command-interpreter.js";
import { logger } from "../lib/logger.js";

const lenderViewedBody = z.object({
  expectedVersion: z.number().int().min(0).optional(),
});

function formatRoles(roles: readonly string[]): string {
  return roles.length ? roles.join(",") : "none";
}

async function resolveAuthorizedTransaction(dealParam: string, orgId: string) {
  return prisma.transaction.findFirst({
    where: {
      orgId,
      OR: [{ id: dealParam }, { publicId: dealParam }],
    },
    select: { id: true, publicId: true },
  });
}

export function createCustodyRouter(env: Env, runtime: CustodyRuntime): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.post(
    "/deals/:dealId/lender-viewed",
    auth,
    asyncHandler(async (req, res) => {
      if (!runtime.commandsEnabled) {
        throw new HttpError(503, "Custody ledger is not configured.", "CUSTODY_DISABLED");
      }
      if (!req.auth) {
        throw new HttpError(401, "Unauthorized", "AUTH_REQUIRED");
      }

      const parsed = lenderViewedBody.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "Invalid body", "VALIDATION_ERROR", parsed.error.flatten());
      }

      const dealParam = req.params.dealId;
      const tx = await resolveAuthorizedTransaction(dealParam, req.auth.orgId);
      if (!tx) {
        throw new HttpError(404, "Deal not found", "NOT_FOUND");
      }

      const ctx = buildCustodyRequestContext(req);
      const command: Command = {
        commandId: randomUUID(),
        commandType: LENDER_VIEWED_DEAL_COMMAND,
        deal_id: tx.id,
        expectedVersion: parsed.data.expectedVersion,
        body: {},
        issuedBy: {
          user_id: req.auth.sub,
          role: formatRoles(req.auth.roles),
        },
      };

      const out = await runtime.service.handleCommand(command, ctx);

      if (!out.projection.ok) {
        logger.error("custody_projection_deferred_after_qldb", {
          eventId: out.event.metadata.event_id,
          dealId: tx.id,
          err: out.projection.errorMessage,
        });
      }

      res.status(200).json({
        ok: true,
        custody: {
          eventId: out.event.metadata.event_id,
          eventType: out.event.metadata.event_type,
          ledgerDocumentId: out.ledger.documentId,
          digestTipBase64: out.ledger.digestTipBase64,
          projectionOk: out.projection.ok,
          projectionError: out.projection.ok ? undefined : out.projection.errorMessage,
        },
        deal: { id: tx.id, publicId: tx.publicId },
      });
    }),
  );

  /**
   * Read model: Postgres projection only (never QLDB). For lender dashboards / reconciliation UIs.
   */
  router.get(
    "/deals/:dealId/read-model",
    auth,
    asyncHandler(async (req, res) => {
      if (!req.auth) {
        throw new HttpError(401, "Unauthorized", "AUTH_REQUIRED");
      }
      const dealParam = req.params.dealId;
      const tx = await resolveAuthorizedTransaction(dealParam, req.auth.orgId);
      if (!tx) {
        throw new HttpError(404, "Deal not found", "NOT_FOUND");
      }

      const [projection, events] = await Promise.all([
        prisma.custodyDealProjection.findUnique({
          where: { transactionId: tx.id },
        }),
        prisma.custodyLedgerEvent.findMany({
          where: { transactionId: tx.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            eventId: true,
            eventType: true,
            createdAt: true,
            qldbDocumentId: true,
            metadataJson: true,
            payloadJson: true,
          },
        }),
      ]);

      const userIds = Array.from(
        new Set(
          events
            .map((event) => {
              const metadata = event.metadataJson as { user_id?: unknown };
              return typeof metadata.user_id === "string" ? metadata.user_id : null;
            })
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          })
        : [];
      const byId = new Map(users.map((u) => [u.id, u.displayName]));

      res.json({
        ok: true,
        deal: { id: tx.id, publicId: tx.publicId },
        projection,
        recentEvents: events.map((event) => {
          const metadata = event.metadataJson as {
            user_id?: unknown;
            role?: unknown;
            timestamp?: unknown;
            event_type?: unknown;
          };
          const payload = event.payloadJson as Record<string, unknown>;
          const userId = typeof metadata.user_id === "string" ? metadata.user_id : null;
          const role = typeof metadata.role === "string" ? metadata.role : "unknown";
          const timestamp =
            typeof metadata.timestamp === "string" ? metadata.timestamp : event.createdAt.toISOString();
          return {
            eventId: event.eventId,
            eventType:
              typeof metadata.event_type === "string" ? metadata.event_type : event.eventType,
            timestamp,
            ledgerDocumentId: event.qldbDocumentId,
            issuedBy: {
              userId,
              userName: userId ? (byId.get(userId) ?? null) : null,
              role,
            },
            payload,
          };
        }),
      });
    }),
  );

  return router;
}
