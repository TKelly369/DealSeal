import { Router } from "express";
import { z } from "zod";
import { PackageFormat } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { createPackageJob } from "../services/package-request-service.js";

const createBody = z.object({
  transactionId: z.string().uuid(),
  formats: z.array(z.nativeEnum(PackageFormat)).min(1),
  certified: z.boolean().optional(),
  templateKey: z.string().min(1).max(120).optional(),
});

export function createPackagesRouter(_env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(_env));

  r.get(
    "/templates",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "AUDITOR",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const items = await prisma.packageTemplate.findMany({
        where: {
          OR: [{ orgId: null }, { orgId }],
          active: true,
        },
        orderBy: { key: "asc" },
      });
      res.json({
        items: items.map((t) => ({ key: t.key, name: t.name, version: t.version })),
      });
    }),
  );

  r.use(
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
  );

  r.post(
    "/jobs",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = createBody.parse(req.body);
      const job = await createPackageJob({
        orgId,
        actorUserId: req.auth!.sub,
        transactionId: body.transactionId,
        formats: body.formats,
        templateKey: body.templateKey,
        certified: body.certified,
      });
      res.status(201).json(job);
    }),
  );

  r.get(
    "/:id/manifest",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "AUDITOR",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const m = await prisma.packageManifest.findFirst({
        where: { packageJobId: req.params.id, transaction: { orgId } },
        include: { packageJob: { select: { id: true, status: true, packageKind: true, certified: true } } },
      });
      if (!m) {
        res.status(404).json({ code: "NOT_FOUND", message: "No manifest for this job" });
        return;
      }
      res.json(m);
    }),
  );

  r.get(
    "/:id/verification",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "AUDITOR",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const m = await prisma.packageManifest.findFirst({
        where: { packageJobId: req.params.id, transaction: { orgId } },
        include: { verification: true },
      });
      if (!m?.verification) {
        res.status(404).json({ code: "NOT_FOUND", message: "No verification record" });
        return;
      }
      res.json(m.verification);
    }),
  );

  return r;
}
