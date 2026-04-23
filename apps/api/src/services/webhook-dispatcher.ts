import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { createHmac, randomBytes } from "node:crypto";

/**
 * If configJson contains `outboundUrl`, POST a signed event (demo / real adapters).
 */
export async function dispatchOutboundWebhook(input: {
  orgId: string;
  configId: string;
  event: string;
  body: Record<string, unknown>;
}): Promise<void> {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { id: input.configId, orgId: input.orgId, active: true },
  });
  if (!cfg) return;
  const c = cfg.configJson as { outboundUrl?: string; signingSecret?: string };
  if (!c?.outboundUrl) return;
  const payload = JSON.stringify({
    event: input.event,
    orgId: input.orgId,
    at: new Date().toISOString(),
    data: input.body,
  });
  const sig = c.signingSecret
    ? createHmac("sha256", c.signingSecret).update(payload).digest("hex")
    : randomBytes(8).toString("hex");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8_000);
  try {
    const res = await fetch(c.outboundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DealSeal-Event": input.event,
        "X-DealSeal-Signature": sig,
      },
      body: payload,
      signal: ac.signal,
    });
    logger.info("outbound_webhook", {
      url: c.outboundUrl,
      status: res.status,
      configId: input.configId,
    });
  } catch (e) {
    logger.warn("outbound_webhook_fail", { err: String(e) });
  } finally {
    clearTimeout(t);
  }
}

export async function dispatchTestOutbound(
  orgId: string,
  configId: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    await dispatchOutboundWebhook({
      orgId,
      configId,
      event: "test.ping",
      body: { ping: true },
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}
