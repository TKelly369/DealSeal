import { Router, type Request } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { verifyRecordMessage } from "../services/governing-record-service.js";
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "../services/governing-record-audit.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

const uuidParam = z.string().uuid("Invalid record id format");

/**
 * @returns Express router mounted at /api/verify
 */
export function createVerifyApiRouter(_env: Env) {
  const r = Router();
  const limit = createRateLimiter({ windowMs: 60_000, max: 120, prefix: "verify" });

  r.get(
    "/:recordId",
    limit,
    asyncHandler(async (req, res) => {
      const raw = (req as Request).params.recordId;
      const check = uuidParam.safeParse(raw);
      if (!check.success) {
        res.status(400).json({ code: "INVALID_ID", message: "A valid record identifier is required" });
        return;
      }
      const id = check.data;
      const g = await prisma.governingRecord.findFirst({
        where: { id },
        select: {
          id: true,
          publicRef: true,
          version: true,
          status: true,
          recordHashSha256: true,
          recordDataJson: true,
          executedAt: true,
          lockedAt: true,
          createdAt: true,
          renderings: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              mode: true,
              baseBodyHashSha256: true,
              renderingHashSha256: true,
              imageHashSha256: true,
              imageMimeType: true,
              imageOutputFormat: true,
              recordHashAtRender: true,
              facsimileTimestamp: true,
              attestationText: true,
              qrVerifyUrl: true,
              createdAt: true,
            },
          },
        },
      });
      if (!g) {
        res.status(404).json({ code: "NOT_FOUND", message: "Record not found" });
        return;
      }
      void appendGoverningRecordAudit({
        governingRecordId: g.id,
        eventKind: GoverningAuditEventKind.VERIFICATION_VIEW,
        message: "Public verification view",
        actorUserId: null,
        requestMetadataJson: { ip: req.ip, userAgent: req.headers["user-agent"] ?? null, path: req.path },
      });
      const { recordVerifies } = verifyRecordMessage(g);
      const latest = g.renderings[0];
      res.json({
        valid: recordVerifies,
        hashMatch: recordVerifies,
        versionMatch: true,
        timestamp: latest?.facsimileTimestamp.toISOString() ?? g.createdAt.toISOString(),
        verificationStatus: recordVerifies ? "VERIFIED" : "MISMATCH",
        governingRecordId: g.id,
        recordId: g.id,
        version: g.version,
        status: g.status,
        recordHash: g.recordHashSha256,
        publicRef: g.publicRef,
        recordVerifies,
        executedAt: g.executedAt?.toISOString() ?? null,
        lockedAt: g.lockedAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
        latestRenderingHash: latest?.renderingHashSha256 ?? null,
        latestImageHash: latest?.imageHashSha256 ?? null,
        latestImageFormat: latest?.imageOutputFormat ?? null,
        latestGeneratedAt: latest?.facsimileTimestamp.toISOString() ?? null,
        latestVerificationUrl: latest?.qrVerifyUrl ?? null,
        renderingHistory: g.renderings.map((e) => ({
          id: e.id,
          mode: e.mode,
          outputFormat: "application/pdf" as const,
          imageFormat: e.imageOutputFormat,
          imageMimeType: e.imageMimeType,
          createdAt: e.createdAt.toISOString(),
          generatedAt: e.facsimileTimestamp.toISOString(),
          baseBodyHash: e.baseBodyHashSha256,
          renderingHash: e.renderingHashSha256,
          imageHash: e.imageHashSha256,
          recordHashAtRender: e.recordHashAtRender,
          facsimileTimestamp: e.facsimileTimestamp.toISOString(),
          attestation: e.attestationText,
          hasQr: Boolean(e.qrVerifyUrl && e.qrVerifyUrl.length > 0),
        })),
      });
    }),
  );

  return r;
}
