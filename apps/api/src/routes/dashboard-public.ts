import { Router } from "express";
import type { Env } from "../config/env.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";

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
  lockedAt: string | null;
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
          lockedAt: record.lockedAt ? record.lockedAt.toISOString() : null,
        }));
        res.json(payload);
        return;
      } catch {
        res.json(FALLBACK_RECORDS);
      }
    }),
  );

  return r;
}
