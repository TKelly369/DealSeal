import { Router } from "express";
import { z } from "zod";
import { PackageFormat, RenderingMode, type UserRole } from "@prisma/client";
import type { Env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { renderContract } from "../contract-renderer/render-contract.js";
import { asyncHandler } from "../util/async-handler.js";
import { requireRoles } from "../middleware/auth.js";
import {
  submitExecutedSourceInstrument,
  verifyExecution,
  getExecutionBundle,
  getExecutionVerifications,
} from "../services/execution-workflow-service.js";
import { getLockStatus, applyTransactionLock } from "../services/lock-activation-service.js";
import {
  generateAuthoritativeEmbodiment,
  getAuthoritativeEmbodiment,
} from "../services/authoritative-embodiment-service.js";
import {
  listPostFundingObligations,
  rebuildPostFundingObligations,
} from "../services/post-funding-obligation-service.js";
import { getFinalClearanceView, completeFinalClearance } from "../services/final-clearance-service.js";
import { createPackageJob } from "../services/package-request-service.js";
import { onDealStateSettled } from "../services/state-hooks.js";

const submitEx = z.object({
  documentId: z.string().uuid(),
  documentVersionId: z.string().uuid().optional(),
});
const verifyEx = z.object({ executedContractId: z.string().uuid() });

const certifiedPkgBody = z.object({
  formats: z.array(z.nativeEnum(PackageFormat)).min(1),
  templateKey: z.string().min(1).max(120).optional(),
});

const contractRenderBody = z.object({
  mode: z.nativeEnum(RenderingMode),
  imageFormat: z.enum(["png", "jpeg"]).optional(),
});

/**
 * Mount on the same `Router` as `createTransactionsRouter` (already behind auth).
 * Register *before* `GET /:id` so `execution` is not parsed as a UUID.
 */
export function registerTransactionAuthorityRoutes(r: Router, _env: Env): void {
  const roles = (req: { auth?: { roles?: UserRole[] } }) =>
    (req.auth?.roles ?? []) as UserRole[];

  r.post(
    "/:id/execution/submit",
    requireRoles("ADMIN", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = submitEx.parse(req.body);
      const out = await submitExecutedSourceInstrument({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        documentId: body.documentId,
        documentVersionId: body.documentVersionId,
        roles: roles(req),
      });
      res.status(201).json(out);
    }),
  );

  r.post(
    "/:id/execution/verify",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = verifyEx.parse(req.body);
      const out = await verifyExecution({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        executedContractId: body.executedContractId,
        roles: roles(req),
      });
      res.json(out);
    }),
  );

  r.get(
    "/:id/execution",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "AUDITOR",
    ),
    asyncHandler(async (req, res) => {
      const out = await getExecutionBundle({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.get(
    "/:id/execution/verification",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "AUDITOR",
    ),
    asyncHandler(async (req, res) => {
      const out = await getExecutionVerifications({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.get(
    "/:id/lock-status",
    asyncHandler(async (req, res) => {
      const out = await getLockStatus({ orgId: req.auth!.orgId, transactionId: req.params.id });
      res.json(out);
    }),
  );

  r.post(
    "/:id/lock",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const out = await applyTransactionLock({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        roles: roles(req),
      });
      await onDealStateSettled({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        toState: "LOCKED",
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/authoritative-embodiment/generate",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const out = await generateAuthoritativeEmbodiment({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
      });
      res.status(201).json(out);
    }),
  );

  r.get(
    "/:id/authoritative-embodiment",
    asyncHandler(async (req, res) => {
      const out = await getAuthoritativeEmbodiment({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/contract-rendering",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = contractRenderBody.parse(req.body);
      const gr = await prisma.governingRecord.findFirst({
        where: { transactionId: req.params.id, orgId },
      });
      if (!gr) {
        res.status(404).json({ code: "NO_GOVERNING_RECORD", message: "No governing record for this deal yet (lock the deal first)." });
        return;
      }
      const out = await renderContract({
        governingRecordId: gr.id,
        orgId,
        mode: body.mode,
        requestedBy: req.auth!.sub,
        imageFormat: body.imageFormat,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/packages/generate-certified",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = certifiedPkgBody.parse(req.body);
      const job = await createPackageJob({
        orgId,
        actorUserId: req.auth!.sub,
        transactionId: req.params.id,
        formats: body.formats,
        templateKey: body.templateKey,
        certified: true,
        packageKind: "CERTIFIED",
      });
      res.status(201).json(job);
    }),
  );

  r.get(
    "/:id/post-funding",
    asyncHandler(async (req, res) => {
      const out = await listPostFundingObligations({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/post-funding/rebuild",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const out = await rebuildPostFundingObligations({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
      });
      res.json(out);
    }),
  );

  r.get(
    "/:id/final-clearance",
    asyncHandler(async (req, res) => {
      const out = await getFinalClearanceView({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/final-clearance/complete",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const out = await completeFinalClearance({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        roles: roles(req),
      });
      res.json(out);
    }),
  );
}
