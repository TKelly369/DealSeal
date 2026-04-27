import { WebhookService } from "@/lib/services/webhook.service";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const expectedToken = process.env.WEBHOOK_RETRY_CRON_TOKEN;
  if (!expectedToken) {
    return Response.json(
      { error: "Missing WEBHOOK_RETRY_CRON_TOKEN configuration." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token !== expectedToken) {
    return unauthorized();
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const result = await WebhookService.processDueRetries(body.limit ?? 25);
  return Response.json({ ok: true, ...result });
}

