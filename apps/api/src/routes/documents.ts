import { Router } from "express";
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import {
  buildObjectKey,
  createDocumentStub,
  registerDocumentVersion,
} from "../services/document-service.js";
import { recordAudit } from "../services/audit-service.js";
import {
  createDocumentUploadIntent,
  finalizeDocumentUpload,
} from "../services/document-upload-service.js";
import { reprocessDocumentVersion } from "../services/document-reprocess-service.js";

const createDocBody = z.object({
  transactionId: z.string().uuid(),
  type: z.nativeEnum(DocumentType),
  /** When set, must match governing `referenceCode` for execution verification to pass. */
  requirementKey: z.string().min(1).max(200).optional(),
});

const versionBody = z.object({
  storageKey: z.string().min(1).optional(),
  mimeType: z.string().min(1),
  byteSize: z.coerce.bigint(),
  sha256: z.string().length(64),
  immutable: z.boolean().optional(),
});

const uploadIntentBody = z.object({
  transactionId: z.string().uuid(),
  documentId: z.string().uuid(),
  mimeType: z.string().min(1),
  maxBytes: z.number().int().positive().max(100 * 1024 * 1024),
  sha256Declared: z.string().length(64).optional(),
  expiresMinutes: z.number().int().min(5).max(120).optional(),
});

const finalizeBody = z.object({
  intentId: z.string().uuid(),
  sha256: z.string().length(64),
  immutable: z.boolean().optional(),
  authoritative: z.boolean().optional(),
});

const reprocessBody = z.object({
  version: z.number().int().positive().optional(),
});

export function createDocumentsRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));

  r.post(
    "/",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = createDocBody.parse(req.body);
      const { id } = await createDocumentStub({
        orgId,
        transactionId: body.transactionId,
        type: body.type,
        requirementKey: body.requirementKey,
      });
      const storageKey = buildObjectKey(orgId, body.transactionId, id);
      await recordAudit({
        orgId,
        transactionId: body.transactionId,
        actorUserId: req.auth!.sub,
        eventType: "DOCUMENT_CREATE",
        action: "DOCUMENT_CREATE",
        entityType: "Document",
        entityId: id,
        resource: "Document",
        resourceId: id,
      });
      res.status(201).json({ id, storageKey });
    }),
  );

  r.post(
    "/upload-intent",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = uploadIntentBody.parse(req.body);
      const out = await createDocumentUploadIntent({
        env,
        orgId,
        actorUserId: req.auth!.sub,
        transactionId: body.transactionId,
        documentId: body.documentId,
        mimeType: body.mimeType,
        maxBytes: body.maxBytes,
        sha256Declared: body.sha256Declared,
        expiresMinutes: body.expiresMinutes,
      });
      res.status(201).json(out);
    }),
  );

  const finalizeHandler = asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId;
    const body = finalizeBody.parse(req.body);
    const out = await finalizeDocumentUpload({
      env,
      orgId,
      actorUserId: req.auth!.sub,
      actorRoles: [...req.auth!.roles],
      documentId: req.params.documentId,
      intentId: body.intentId,
      sha256: body.sha256,
      immutable: body.immutable,
      authoritative: body.authoritative,
      reqMeta: { ip: req.ip, userAgent: req.headers["user-agent"] as string | undefined },
    });
    res.status(201).json(out);
  });

  r.post(
    "/:documentId/finalize-upload",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    finalizeHandler,
  );

  r.post(
    "/:documentId/finalize",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    finalizeHandler,
  );

  r.post(
    "/:documentId/reprocess",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = reprocessBody.parse(req.body);
      const out = await reprocessDocumentVersion({
        orgId,
        documentId: req.params.documentId,
        actorUserId: req.auth!.sub,
        version: body.version,
        reqMeta: { ip: req.ip, userAgent: req.headers["user-agent"] as string | undefined },
      });
      res.json(out);
    }),
  );

  r.post(
    "/:documentId/versions",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = versionBody.parse(req.body);
      const transactionId = z.string().uuid().parse(req.query.transactionId);
      const storageKey =
        body.storageKey ??
        buildObjectKey(orgId, transactionId, req.params.documentId);
      const result = await registerDocumentVersion({
        orgId,
        transactionId,
        documentId: req.params.documentId,
        storageKey,
        mimeType: body.mimeType,
        byteSize: body.byteSize,
        sha256: body.sha256,
        immutable: body.immutable,
      });
      await recordAudit({
        orgId,
        transactionId,
        actorUserId: req.auth!.sub,
        eventType: "DOCUMENT_VERSION",
        action: "DOCUMENT_VERSION",
        entityType: "Document",
        entityId: req.params.documentId,
        resource: "Document",
        resourceId: req.params.documentId,
        payload: { version: result.version },
      });
      res.status(201).json(result);
    }),
  );

  return r;
}
