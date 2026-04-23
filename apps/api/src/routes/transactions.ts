import { Router } from "express";
import { z } from "zod";
import { TransactionState, type UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { asyncHandler } from "../util/async-handler.js";
import {
  createAuthMiddleware,
  requireRoles,
} from "../middleware/auth.js";
import type { Env } from "../config/env.js";
import { recordAudit } from "../services/audit-service.js";
import { assertNoActiveHold } from "../services/hold-service.js";
import {
  patchBuyerProfile,
  patchDealFinancials,
  patchVehicleRecord,
} from "../services/transaction-patch-service.js";
import {
  getAllowedNextStates,
  getTransactionStateSnapshot,
  transitionTransaction,
} from "../services/state-engine.js";
import { onDealStateSettled } from "../services/state-hooks.js";
import {
  getLatestLenderEvaluation,
  runLenderEvaluationForTransaction,
} from "../services/lender-evaluation-service.js";
import {
  getCompletionProtocolView,
  rebuildCompletionProtocol,
} from "../services/completion-protocol.js";
import { assertCoreDealDataMutable } from "../services/lock-guard.js";
import { registerTransactionAuthorityRoutes } from "./transaction-authority-routes.js";

const createBody = z.object({
  referenceCode: z.string().min(4),
  title: z.string().min(1),
});

const patchMeta = z.object({
  expectedVersion: z.number().int().positive().optional(),
  reason: z.string().max(2000).optional(),
});

const buyerPatchBody = patchMeta.extend({
  legalName: z.string().min(1).optional(),
  dob: z.coerce.date().nullable().optional(),
  addressJson: z.record(z.string(), z.any()).optional(),
  identifiersJson: z.record(z.string(), z.any()).optional(),
});

const vehiclePatchBody = patchMeta.extend({
  vin: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  trim: z.string().nullable().optional(),
  mileage: z.number().int().nullable().optional(),
  rawJson: z.record(z.string(), z.any()).optional(),
});

const financialsPatchBody = patchMeta.extend({
  amountFinanced: z.number().positive().optional(),
  aprBps: z.number().int().nullable().optional(),
  termMonths: z.number().int().nullable().optional(),
  paymentJson: z.record(z.string(), z.any()).optional(),
  lenderCode: z.string().nullable().optional(),
});

const stateBody = z.object({
  toState: z.nativeEnum(TransactionState),
  reason: z.string().optional(),
});

const lenderRunBody = z.object({
  lenderProgramId: z.string().uuid().optional(),
});

const programPickBody = z.object({
  lenderProgramId: z.string().uuid(),
});

export function createTransactionsRouter(env: Env): Router {
  const r = Router();
  const auth = createAuthMiddleware(env);

  r.use(auth);

  registerTransactionAuthorityRoutes(r, env);

  r.get(
    "/",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const rows = await prisma.transaction.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: { governingAgreement: true },
      });
      res.json({
        items: rows.map((t) => ({
          id: t.id,
          publicId: t.publicId,
          state: t.state,
          governingAgreementId: t.governingAgreement?.id ?? null,
          updatedAt: t.updatedAt.toISOString(),
        })),
      });
    }),
  );

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
      await assertNoActiveHold({ orgId });
      const body = createBody.parse(req.body);

      const existingRef = await prisma.governingAgreement.findUnique({
        where: { referenceCode: body.referenceCode },
      });
      if (existingRef) {
        throw new HttpError(409, "Governing reference already used", "REF_IN_USE");
      }

      const result = await prisma.$transaction(async (db) => {
        const tx = await db.transaction.create({
          data: { orgId, state: "DRAFT" },
        });
        const ga = await db.governingAgreement.create({
          data: {
            transactionId: tx.id,
            referenceCode: body.referenceCode,
            title: body.title,
          },
        });
        await db.transactionAuthorityFile.create({
          data: {
            transactionId: tx.id,
            manifestJson: { version: 1, sealed: false },
          },
        });
        return { tx, ga };
      });

      await recordAudit({
        orgId,
        transactionId: result.tx.id,
        actorUserId: req.auth!.sub,
        eventType: "TRANSACTION_CREATE",
        action: "TRANSACTION_CREATE",
        entityType: "Transaction",
        entityId: result.tx.id,
        resource: "Transaction",
        resourceId: result.tx.id,
        payload: { governingAgreementId: result.ga.id },
      });

      res.status(201).json({
        id: result.tx.id,
        publicId: result.tx.publicId,
        state: result.tx.state,
        governingAgreementId: result.ga.id,
      });
    }),
  );

  r.get(
    "/:id/buyer/versions",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const profile = await prisma.buyerProfile.findFirst({
        where: { transactionId: req.params.id, transaction: { orgId } },
        include: { versions: { orderBy: { version: "desc" } } },
      });
      if (!profile) {
        res.json({ items: [] });
        return;
      }
      res.json({ items: profile.versions });
    }),
  );

  r.get(
    "/:id/vehicle/versions",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const rec = await prisma.vehicleRecord.findFirst({
        where: { transactionId: req.params.id, transaction: { orgId } },
        include: { versions: { orderBy: { version: "desc" } } },
      });
      if (!rec) {
        res.json({ items: [] });
        return;
      }
      res.json({ items: rec.versions });
    }),
  );

  r.get(
    "/:id/financials/versions",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const row = await prisma.dealFinancials.findFirst({
        where: { transactionId: req.params.id, transaction: { orgId } },
        include: { versions: { orderBy: { version: "desc" } } },
      });
      if (!row) {
        res.json({ items: [] });
        return;
      }
      res.json({ items: row.versions });
    }),
  );

  r.patch(
    "/:id/buyer",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = buyerPatchBody.parse(req.body);
      const { expectedVersion, reason, ...patch } = body;
      const result = await patchBuyerProfile({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        patch,
        meta: {
          expectedVersion,
          reason,
          ip: req.ip,
          userAgent: req.headers["user-agent"] as string | undefined,
        },
      });
      res.json(result);
    }),
  );

  r.patch(
    "/:id/vehicle",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = vehiclePatchBody.parse(req.body);
      const { expectedVersion, reason, ...patch } = body;
      const result = await patchVehicleRecord({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        patch,
        meta: {
          expectedVersion,
          reason,
          ip: req.ip,
          userAgent: req.headers["user-agent"] as string | undefined,
        },
      });
      res.json(result);
    }),
  );

  r.patch(
    "/:id/financials",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = financialsPatchBody.parse(req.body);
      const { expectedVersion, reason, ...patch } = body;
      const result = await patchDealFinancials({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        patch,
        meta: {
          expectedVersion,
          reason,
          ip: req.ip,
          userAgent: req.headers["user-agent"] as string | undefined,
        },
      });
      res.json(result);
    }),
  );

  r.get(
    "/:id/state",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const s = await getTransactionStateSnapshot({
        orgId,
        transactionId: req.params.id,
      });
      res.json(s);
    }),
  );

  r.get(
    "/:id/state/allowed-transitions",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const t = await getAllowedNextStates({
        orgId,
        transactionId: req.params.id,
        roles: req.auth!.roles as UserRole[],
      });
      res.json({ items: t });
    }),
  );

  r.post(
    "/:id/state/transition",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = stateBody.parse(req.body);
      await transitionTransaction({
        orgId,
        transactionId: req.params.id,
        toState: body.toState,
        actorUserId: req.auth!.sub,
        roles: req.auth!.roles as UserRole[],
        reason: body.reason,
      });
      await onDealStateSettled({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        toState: body.toState,
      });
      res.json({ ok: true });
    }),
  );

  r.get(
    "/:id/lender-evaluation",
    asyncHandler(async (req, res) => {
      const out = await getLatestLenderEvaluation({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/lender-evaluation/run",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = lenderRunBody.parse(req.body);
      const r0 = await runLenderEvaluationForTransaction({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
        lenderProgramId: body.lenderProgramId,
      });
      await rebuildCompletionProtocol({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
      });
      res.status(201).json(r0);
    }),
  );

  r.patch(
    "/:id/selected-lender-program",
    requireRoles("ADMIN", "DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const { lenderProgramId } = programPickBody.parse(req.body);
      await assertCoreDealDataMutable({ orgId, transactionId: req.params.id });
      const tx = await prisma.transaction.findFirst({
        where: { id: req.params.id, orgId },
        select: { id: true },
      });
      if (!tx) throw new HttpError(404, "Not found", "NOT_FOUND");
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { selectedLenderProgramId: lenderProgramId },
      });
      res.json({ ok: true, selectedLenderProgramId: lenderProgramId });
    }),
  );

  r.get(
    "/:id/completion-protocol",
    asyncHandler(async (req, res) => {
      const out = await getCompletionProtocolView({
        orgId: req.auth!.orgId,
        transactionId: req.params.id,
      });
      res.json(out);
    }),
  );

  r.post(
    "/:id/completion-protocol/rebuild",
    requireRoles(
      "ADMIN",
      "DEALER_USER",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
    ),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const n = await rebuildCompletionProtocol({
        orgId,
        transactionId: req.params.id,
        actorUserId: req.auth!.sub,
      });
      res.json(n);
    }),
  );

  r.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const tx = await prisma.transaction.findFirst({
        where: { id: req.params.id, orgId },
        include: {
          governingAgreement: true,
          buyer: true,
          vehicle: true,
          financials: true,
          discrepancies: true,
          holds: { where: { active: true } },
        },
      });
      if (!tx) throw new HttpError(404, "Not found", "NOT_FOUND");
      res.json(tx);
    }),
  );

  return r;
}
