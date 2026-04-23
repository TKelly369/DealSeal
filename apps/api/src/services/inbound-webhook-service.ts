import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit-service.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../lib/http-error.js";

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf-8").digest("hex");
}

/**
 * Inbound provider webhook: verify X-DealSeal-Signature = HMAC-SHA256(secret, raw body).
 * Body: JSON with configId, event, data (arbitrary). Optional transactionId in data.
 */
export async function processInboundIntegrationWebhook(
  input: { rawBody: string; receivedSig: string | undefined },
): Promise<{ ok: true; logId: string; configId: string }> {
  let bodyJson: { configId?: string; event?: string; data?: unknown };
  try {
    bodyJson = JSON.parse(input.rawBody) as { configId?: string; event?: string; data?: unknown };
  } catch {
    throw new HttpError(400, "Invalid JSON", "INVALID_JSON");
  }
  const configId = bodyJson.configId;
  if (typeof configId !== "string") {
    throw new HttpError(400, "configId required", "MISSING_CONFIG");
  }
  const cfg = await prisma.integrationConfig.findFirst({
    where: { id: configId, active: true },
    include: { org: { select: { id: true } } },
  });
  if (!cfg) throw new HttpError(404, "Config not found", "NOT_FOUND");
  if (!cfg.inboundSecret) {
    throw new HttpError(501, "inbound secret not set on config", "NO_INBOUND_SECRET");
  }
  const expect = sign(cfg.inboundSecret, input.rawBody);
  const rec = (input.receivedSig ?? "").trim();
  if (!rec) {
    throw new HttpError(401, "Invalid signature", "BAD_SIG");
  }
  const a = Buffer.from(expect, "hex");
  const b = Buffer.from(rec, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, "Invalid signature", "BAD_SIG");
  }

  const log = await prisma.integrationLog.create({
    data: {
      configId: cfg.id,
      kind: "WEBHOOK_INBOUND",
      requestSummaryJson: { event: bodyJson.event ?? "unknown" },
      responseSummaryJson: { received: true },
      status: "SUCCEEDED",
      durationMs: 0,
    },
  });
  const txInData = bodyJson.data as { transactionId?: string } | undefined;
  if (txInData?.transactionId) {
    await prisma.integrationLog.update({
      where: { id: log.id },
      data: { transactionId: txInData.transactionId },
    });
  }
  await recordAudit({
    orgId: cfg.orgId,
    transactionId: txInData?.transactionId ?? null,
    actorUserId: null,
    eventType: "WEBHOOK_INBOUND",
    action: "WEBHOOK_INBOUND",
    resource: "IntegrationLog",
    resourceId: log.id,
    entityType: "IntegrationLog",
    entityId: log.id,
    payload: { event: bodyJson.event, configId: cfg.id },
  });
  logger.info("inbound_webhook", { orgId: cfg.orgId, configId: cfg.id, logId: log.id });
  return { ok: true, logId: log.id, configId: cfg.id };
}
