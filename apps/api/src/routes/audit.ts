import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { getTransactionTimeline } from "../services/audit-query-service.js";
import {
  getDocumentAuditDetail,
  getNormalizedTransactionTimeline,
  getPackageAuditDetail,
  getTransactionAuditDetail,
  searchAuditEvents,
} from "../services/audit-read-service.js";

const readRoles = ["AUDITOR", "ADMIN", "COMPLIANCE_OFFICER"] as const;

export function createAuditRouter(_env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(_env));
  r.use(requireRoles(...readRoles));

  r.get(
    "/transactions/:transactionId",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const detail = await getTransactionAuditDetail({
        orgId,
        transactionId: req.params.transactionId,
      });
      res.json(detail);
    }),
  );

  r.get(
    "/transactions/:transactionId/timeline",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit);
      const types = z.string().optional().parse(req.query.types);
      const cursor = z.string().optional().parse(req.query.cursor);
      const normalized = z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true")
        .parse(req.query.normalized);

      if (normalized) {
        const result = await getNormalizedTransactionTimeline({
          orgId,
          transactionId: req.params.transactionId,
          types,
          limit,
          cursor,
        });
        res.json(result);
        return;
      }

      const result = await getTransactionTimeline({
        orgId,
        transactionId: req.params.transactionId,
        types,
        limit,
        cursor,
      });
      res.json(result);
    }),
  );

  r.get(
    "/documents/:documentId",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const detail = await getDocumentAuditDetail({
        orgId,
        documentId: req.params.documentId,
      });
      res.json(detail);
    }),
  );

  r.get(
    "/packages/:packageJobId",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const detail = await getPackageAuditDetail({
        orgId,
        packageJobId: req.params.packageJobId,
      });
      res.json(detail);
    }),
  );

  r.get(
    "/search",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit);
      const cursor = z.string().optional().parse(req.query.cursor);
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const eventTypes = z
        .string()
        .optional()
        .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined))
        .parse(req.query.eventTypes);
      const actorUserId = z.string().uuid().optional().parse(req.query.actorUserId);
      const entityType = z.string().optional().parse(req.query.entityType);
      const entityId = z.string().optional().parse(req.query.entityId);
      const from = z.coerce.date().optional().parse(req.query.from);
      const to = z.coerce.date().optional().parse(req.query.to);

      const result = await searchAuditEvents({
        orgId,
        transactionId,
        eventTypes,
        actorUserId,
        entityType,
        entityId,
        from,
        to,
        limit,
        cursor,
      });
      res.json(result);
    }),
  );

  return r;
}
