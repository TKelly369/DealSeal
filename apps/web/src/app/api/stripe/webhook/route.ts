import Stripe from "stripe";
import { prisma } from "@/lib/db";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" }) : null;

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return new Response("Stripe is not configured", { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  // TODO: [Production] Ensure raw body parsing is enabled in Next.config
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = session.metadata?.workspaceId;
    if (workspaceId) {
      await prisma.subscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
          stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
          status: "ACTIVE",
        },
        update: {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
          status: "ACTIVE",
        },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const statusMap: Record<string, "ACTIVE" | "PAST_DUE" | "CANCELED"> = {
      active: "ACTIVE",
      past_due: "PAST_DUE",
      canceled: "CANCELED",
      unpaid: "PAST_DUE",
      incomplete: "PAST_DUE",
      incomplete_expired: "CANCELED",
      trialing: "ACTIVE",
      paused: "PAST_DUE",
    };
    const mappedStatus = statusMap[sub.status] ?? "PAST_DUE";

    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : undefined,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        status: mappedStatus,
      },
    });
  }

  return new Response("ok", { status: 200 });
}
