import crypto from "crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

function signPayload(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function nextRetryDate(retryCount: number): Date | null {
  if (retryCount <= 0) return new Date(Date.now() + 60_000);
  if (retryCount === 1) return new Date(Date.now() + 5 * 60_000);
  if (retryCount === 2) return new Date(Date.now() + 30 * 60_000);
  return null;
}

async function postWebhookWithTimeout(url: string, headers: Record<string, string>, body: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhookEndpoint: true },
  });
  if (!delivery || !delivery.webhookEndpoint.isActive) return;

  const payloadText = JSON.stringify(delivery.payload);
  const signature = signPayload(delivery.webhookEndpoint.secret, payloadText);
  const payloadObj = delivery.payload as Record<string, unknown>;
  const eventTypeHeader = typeof payloadObj?.eventType === "string" ? payloadObj.eventType : "DEALSEAL_EVENT";
  const currentRetry = delivery.retryCount;

  try {
    const res = await postWebhookWithTimeout(
      delivery.webhookEndpoint.url,
      {
        "content-type": "application/json",
        "x-dealseal-signature": signature,
        "x-dealseal-event": eventTypeHeader,
        "x-dealseal-event-id": delivery.eventId,
      },
      payloadText,
    );

    const responseBody = await res.text();
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          responseStatusCode: res.status,
          deliveryStatus: "SUCCESS",
          nextRetryAt: null,
          lastError: null,
        },
      });
      return;
    }

    const newRetryCount = currentRetry + 1;
    const retryAt = nextRetryDate(currentRetry);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        responseStatusCode: res.status,
        retryCount: newRetryCount,
        nextRetryAt: retryAt,
        deliveryStatus: retryAt ? "PENDING" : "FAILED",
        lastError: responseBody || `HTTP ${res.status}`,
      },
    });
  } catch (error) {
    const newRetryCount = currentRetry + 1;
    const retryAt = nextRetryDate(currentRetry);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        retryCount: newRetryCount,
        nextRetryAt: retryAt,
        deliveryStatus: retryAt ? "PENDING" : "FAILED",
        lastError: error instanceof Error ? error.message : "Unknown webhook delivery error",
      },
    });
  }
}

export const WebhookService = {
  async dispatchEvent(workspaceId: string, eventType: string, payload: Record<string, unknown>) {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: eventType },
      },
    });
    const eventId = crypto.randomUUID();

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const created = await prisma.webhookDelivery.create({
          data: {
            webhookEndpointId: endpoint.id,
            eventId,
            payload: payload as Prisma.InputJsonValue,
            deliveryStatus: "PENDING",
          },
        });

        setTimeout(async () => {
          await attemptDelivery(created.id);
        }, 0);
      }),
    );
  },

  async redeliverWebhook(deliveryId: string) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        deliveryStatus: "PENDING",
      },
    });
    await attemptDelivery(deliveryId);
  },

  async processDueRetries(limit = 25) {
    const due = await prisma.webhookDelivery.findMany({
      where: {
        deliveryStatus: "PENDING",
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { nextRetryAt: "asc" },
      take: Math.max(1, Math.min(limit, 200)),
      select: { id: true },
    });

    for (const row of due) {
      await attemptDelivery(row.id);
    }

    return { processed: due.length };
  },
};

