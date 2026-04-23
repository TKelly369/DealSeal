import Stripe from "stripe";
import type { Env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

export function getStripe(env: Env): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function ensureStripeCustomer(
  stripe: Stripe,
  orgId: string,
): Promise<string> {
  const sub = await prisma.billingSubscription.findUnique({
    where: { orgId },
  });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new HttpError(404, "Organization not found", "NOT_FOUND");

  const customer = await stripe.customers.create({
    metadata: { orgId },
    name: org.name,
  });

  await prisma.billingSubscription.upsert({
    where: { orgId },
    create: {
      orgId,
      tier: "STARTER",
      stripeCustomerId: customer.id,
      status: "incomplete",
    },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export function verifyStripeWebhook(
  stripe: Stripe,
  rawBody: Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
