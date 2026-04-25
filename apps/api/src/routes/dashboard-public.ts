import { Router } from "express";
import { RenderingMode } from "@prisma/client";
import type { Env } from "../config/env.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { renderContractArtifacts } from "../contract-renderer/render-contract.js";

type DashboardMetricsResponse = {
  totalContracts: number;
  certifiedRenderings: number;
  verificationRequests: number;
  activeDeals: number;
};

type GoverningRecordListItem = {
  id: string;
  dealId: string;
  version: number;
  status: string;
  hash: string;
  createdAt: string;
  lockedAt: string | null;
};

type GoverningRecordDetail = {
  id: string;
  dealId: string;
  version: number;
  status: string;
  hash: string;
  createdAt: string;
  lockedAt: string | null;
  custodian: string;
  contractData: unknown;
};

const ACTIVE_DEAL_STATES = ["DRAFT", "CONDITIONAL", "APPROVED", "EXECUTED", "LOCKED", "POST_FUNDING_PENDING"];

const FALLBACK_METRICS: DashboardMetricsResponse = {
  totalContracts: 0,
  certifiedRenderings: 0,
  verificationRequests: 0,
  activeDeals: 0,
};

const FALLBACK_RECORDS: GoverningRecordListItem[] = [
  {
    id: "gr-fallback-001",
    dealId: "DL-1001",
    version: 1,
    status: "LOCKED",
    hash: "sha256:fallback-governing-record-hash-001",
    createdAt: new Date(0).toISOString(),
    lockedAt: null,
  },
];

export function createDashboardPublicRouter(_env: Env): Router {
  const r = Router();

  r.get(
    "/dashboard/metrics",
    asyncHandler(async (_req, res) => {
      try {
        const [totalContracts, certifiedRenderings, verificationRequests, activeDeals] = await Promise.all([
          prisma.governingRecord.count(),
          prisma.renderingEvent.count({ where: { mode: "CERTIFIED" } }),
          prisma.auditLog.count({
            where: {
              eventKind: { contains: "VERIFICATION" },
            },
          }),
          prisma.transaction.count({
            where: {
              state: { in: ACTIVE_DEAL_STATES as never[] },
            },
          }),
        ]);

        res.json({
          totalContracts,
          certifiedRenderings,
          verificationRequests,
          activeDeals,
        } satisfies DashboardMetricsResponse);
        return;
      } catch {
        res.json(FALLBACK_METRICS);
      }
    }),
  );

  r.get(
    "/governing-records",
    asyncHandler(async (_req, res) => {
      try {
        const records = await prisma.governingRecord.findMany({
          orderBy: [{ lockedAt: "desc" }, { updatedAt: "desc" }],
          take: 50,
          select: {
            id: true,
            transactionId: true,
            version: true,
            status: true,
          createdAt: true,
            recordHashSha256: true,
            lockedAt: true,
            transaction: {
              select: {
                publicId: true,
              },
            },
          },
        });

        const payload: GoverningRecordListItem[] = records.map((record) => ({
          id: record.id,
          dealId: record.transaction?.publicId ?? record.transactionId,
          version: record.version,
          status: record.status,
          hash: record.recordHashSha256,
          createdAt: record.createdAt.toISOString(),
          lockedAt: record.lockedAt ? record.lockedAt.toISOString() : null,
        }));
        res.json(payload);
        return;
      } catch {
        res.json(FALLBACK_RECORDS);
      }
    }),
  );

  r.get(
    "/governing-records/:recordId",
    asyncHandler(async (req, res) => {
      const recordId = req.params.recordId;
      const record = await prisma.governingRecord.findFirst({
        where: { id: recordId },
        select: {
          id: true,
          dealId: true,
          transactionId: true,
          version: true,
          status: true,
          hash: true,
          createdAt: true,
          lockedAt: true,
          custodian: true,
          contractData: true,
          recordDataJson: true,
          transaction: {
            select: {
              publicId: true,
            },
          },
        },
      });
      if (!record) {
        res.status(404).json({ code: "NOT_FOUND", message: "Governing record not found" });
        return;
      }

      const contractData =
        typeof record.contractData === "object" &&
        record.contractData !== null &&
        !Array.isArray(record.contractData) &&
        Object.keys(record.contractData as Record<string, unknown>).length > 0
          ? record.contractData
          : record.recordDataJson;

      res.json({
        id: record.id,
        dealId: record.dealId || record.transaction?.publicId || record.transactionId,
        version: record.version,
        status: record.status,
        hash: record.hash || "",
        createdAt: record.createdAt.toISOString(),
        lockedAt: record.lockedAt?.toISOString() ?? null,
        custodian: record.custodian,
        contractData,
      } satisfies GoverningRecordDetail);
    }),
  );

  r.post(
    "/render",
    asyncHandler(async (req, res) => {
      const body = req.body as { recordId?: string; mode?: string };
      if (!body?.recordId || !body?.mode) {
        res.status(400).json({ code: "BAD_REQUEST", message: "recordId and mode are required" });
        return;
      }
      if (body.mode !== RenderingMode.CERTIFIED && body.mode !== RenderingMode.NON_AUTHORITATIVE) {
        res.status(400).json({ code: "BAD_MODE", message: "mode must be CERTIFIED or NON_AUTHORITATIVE" });
        return;
      }

      const governingRecord = await prisma.governingRecord.findFirst({
        where: { id: body.recordId },
        select: { id: true, orgId: true },
      });
      if (!governingRecord) {
        res.status(404).json({ code: "NOT_FOUND", message: "Governing record not found" });
        return;
      }

      const rendered = await renderContractArtifacts({
        governingRecordId: governingRecord.id,
        orgId: governingRecord.orgId,
        mode: body.mode as RenderingMode,
        requestedBy: "system",
      });

      const pdfBuffer = Buffer.from(rendered.pdfBase64, "base64");
      const filePrefix = body.mode === RenderingMode.CERTIFIED ? "certified" : "copy";
      const filename = `DealSeal-${filePrefix}-${rendered.publicRef}-v${rendered.recordVersion}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Rendering-Event-Id", rendered.renderingEventId);
      res.setHeader("X-Rendering-Hash", rendered.renderingHashSha256);
      res.send(pdfBuffer);
    }),
  );

  return r;
}
