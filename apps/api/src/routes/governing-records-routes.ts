import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { RenderingMode } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { renderContract } from "../contract-renderer/render-contract.js";
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "../services/governing-record-audit.js";

const renderBody = z.object({
  mode: z.nativeEnum(RenderingMode),
  imageFormat: z.enum(["png", "jpeg"]).optional(),
});

const downloadPostBody = z.object({
  mode: z.nativeEnum(RenderingMode),
  imageFormat: z.enum(["png", "jpeg"]).optional(),
});

function filePrefix(mode: RenderingMode): "certified" | "convenience" {
  return mode === "CERTIFIED" ? "certified" : "convenience";
}

export function createGoverningRecordsRouter(env: Env) {
  const r = Router();
  r.use(createAuthMiddleware(env));

  r.get(
    "/:id/raw",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "AUDITOR"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const g = await prisma.governingRecord.findFirst({ where: { id, orgId } });
      if (!g) {
        res.status(404).json({ code: "NOT_FOUND" });
        return;
      }
      void appendGoverningRecordAudit({
        governingRecordId: g.id,
        eventKind: GoverningAuditEventKind.UNAUTHORIZED_RAW_ACCESS,
        message: "Attempted download of raw governing record (blocked)",
        actorUserId: req.auth?.sub ?? null,
        requestMetadataJson: { path: req.path, ip: req.ip },
      });
      res.status(403).json({
        code: "RAW_GOVERNING_RECORD_FORBIDDEN",
        message: "The authoritative record is not available as a raw file. Use certified rendering or convenience copy.",
      });
    }),
  );

  r.post(
    "/:id/render",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const body = renderBody.parse(req.body);
      const out = await renderContract({
        governingRecordId: id,
        orgId,
        mode: body.mode,
        requestedBy: req.auth!.sub,
        imageFormat: body.imageFormat,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/download/pdf",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "AUDITOR"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const body = downloadPostBody.parse(req.body);
      const rendered = await renderContract({
        governingRecordId: id,
        orgId,
        mode: body.mode,
        requestedBy: req.auth!.sub,
        imageFormat: body.imageFormat,
      });
      const pdfBuffer = Buffer.from(rendered.pdfBase64, "base64");
      const filename = `DealScan-${filePrefix(body.mode)}-${rendered.publicRef}-v${rendered.recordVersion}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Rendering-Event-Id", rendered.renderingEventId);
      res.setHeader("X-Rendering-Hash", rendered.renderingHashSha256);
      res.setHeader("X-Record-Hash", rendered.recordHashAtRender);
      res.setHeader("X-Image-Hash", rendered.imageHashSha256);
      res.send(pdfBuffer);
    }),
  );

  r.post(
    "/:id/download/image",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "AUDITOR"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const body = downloadPostBody.parse(req.body);
      const rendered = await renderContract({
        governingRecordId: id,
        orgId,
        mode: body.mode,
        requestedBy: req.auth!.sub,
        imageFormat: body.imageFormat ?? "png",
      });
      const imageBuffer = Buffer.from(rendered.imageBase64, "base64");
      const ext = rendered.imageOutputFormat === "JPEG" ? "jpg" : "png";
      const filename = `DealScan-${filePrefix(body.mode)}-${rendered.publicRef}-v${rendered.recordVersion}.${ext}`;
      res.setHeader("Content-Type", rendered.imageMimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Rendering-Event-Id", rendered.renderingEventId);
      res.setHeader("X-Image-Hash", rendered.imageHashSha256);
      res.setHeader("X-Rendering-Hash", rendered.renderingHashSha256);
      res.setHeader("X-Record-Hash", rendered.recordHashAtRender);
      res.send(imageBuffer);
    }),
  );

  return r;
}
