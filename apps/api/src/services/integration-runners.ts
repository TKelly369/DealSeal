import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";
import { logger } from "../lib/logger.js";
import { dispatchOutboundWebhook } from "./webhook-dispatcher.js";

/** Mock lender: accepts deal payload, returns a pseudo decision. */
export async function runLenderSubmitDeal(input: {
  orgId: string;
  configId: string;
  transactionId: string;
  payloadJson: Record<string, unknown>;
  actorUserId: string;
}): Promise<{
  decision: string;
  reference: string;
  logId: string;
}> {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { id: input.configId, orgId: input.orgId, active: true },
    include: { provider: true },
  });
  if (!cfg) throw new HttpError(404, "Integration config not found", "NOT_FOUND");
  if (cfg.provider.category !== "LENDER" && !cfg.provider.key.startsWith("MOCK")) {
    // allow mock-style keys for demo
  }
  const t0 = Date.now();
  const ref = `LEND-${input.transactionId.slice(0, 8)}`;
  const decision = "APPROVED_CONDITIONAL";
  const durationMs = Date.now() - t0;
  const log = await prisma.integrationLog.create({
    data: {
      configId: cfg.id,
      transactionId: input.transactionId,
      kind: "LENDER_SUBMIT",
      requestSummaryJson: { hasPayload: true, size: JSON.stringify(input.payloadJson).length },
      responseSummaryJson: { decision, reference: ref, adapter: "mock" },
      status: "SUCCEEDED",
      durationMs,
    },
  });
  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "INTEGRATION_LENDER_SUBMIT",
    action: "INTEGRATION_LENDER_SUBMIT",
    resource: "IntegrationLog",
    resourceId: log.id,
    entityType: "IntegrationLog",
    entityId: log.id,
    payload: { decision, reference: ref },
  });
  logger.info("lender_submitted", { transactionId: input.transactionId, logId: log.id });
  await dispatchOutboundWebhook({
    orgId: input.orgId,
    configId: cfg.id,
    event: "lender.submitted",
    body: { transactionId: input.transactionId, decision, reference: ref },
  }).catch(() => {});
  return { decision, reference: ref, logId: log.id };
}

export async function getLenderStatusForTransaction(
  orgId: string,
  transactionId: string,
): Promise<{ lastLog: { status: string; responseSummaryJson: unknown; createdAt: string } | null }> {
  const row = await prisma.integrationLog.findFirst({
    where: { transactionId, config: { orgId }, kind: "LENDER_SUBMIT" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { lastLog: null };
  return {
    lastLog: {
      status: row.status,
      responseSummaryJson: row.responseSummaryJson,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function runCreditPull(input: {
  orgId: string;
  configId: string;
  transactionId: string;
  pullType: "SOFT" | "HARD";
  subjectJson: Record<string, unknown>;
}): Promise<{ pullId: string; score: number; logId: string }> {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { id: input.configId, orgId: input.orgId, active: true },
  });
  if (!cfg) throw new HttpError(404, "Integration config not found", "NOT_FOUND");
  const t0 = Date.now();
  const pullId = `CR-${input.transactionId.slice(0, 6)}`;
  const score = 700 + (input.pullType === "HARD" ? -5 : 0);
  const log = await prisma.integrationLog.create({
    data: {
      configId: cfg.id,
      transactionId: input.transactionId,
      kind: `CREDIT_${input.pullType}`,
      requestSummaryJson: { subjectKeys: Object.keys(input.subjectJson) },
      responseSummaryJson: { pullId, score, adapter: "mock_credit" },
      status: "SUCCEEDED",
      durationMs: Date.now() - t0,
    },
  });
  return { pullId, score, logId: log.id };
}

export async function runIdentityVerify(input: {
  orgId: string;
  configId: string;
  transactionId: string;
  piiRef: string;
}): Promise<{ status: "VERIFIED" | "NEEDS_REVIEW"; logId: string }> {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { id: input.configId, orgId: input.orgId, active: true },
  });
  if (!cfg) throw new HttpError(404, "Integration config not found", "NOT_FOUND");
  const t0 = Date.now();
  const st: "VERIFIED" | "NEEDS_REVIEW" = input.piiRef.length > 3 ? "VERIFIED" : "NEEDS_REVIEW";
  const log = await prisma.integrationLog.create({
    data: {
      configId: cfg.id,
      transactionId: input.transactionId,
      kind: "IDENTITY_VERIFY",
      requestSummaryJson: { piiRefLen: input.piiRef.length },
      responseSummaryJson: { status: st, adapter: "mock_identity" },
      status: "SUCCEEDED",
      durationMs: Date.now() - t0,
    },
  });
  return { status: st, logId: log.id };
}
