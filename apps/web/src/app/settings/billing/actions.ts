"use server";

import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership, getWorkspaceSubscription } from "@/lib/dal";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" }) : null;

async function requireUserSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireWorkspaceMembership(userId: string, workspaceId: string) {
  const membership = await getMembership(userId, workspaceId);
  if (!membership) {
    throw new Error("Forbidden workspace");
  }
  return membership;
}

export async function createCheckoutSession({
  workspaceId,
  userEmail,
}: {
  workspaceId: string;
  userEmail: string;
}) {
  const session = await requireUserSession();
  if (!stripe) throw new Error("Stripe is not configured.");
  await requireWorkspaceMembership(session.user.id, workspaceId);
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error("Missing STRIPE_PRO_PRICE_ID.");

  let subscription = await getWorkspaceSubscription(workspaceId);

  let customerId = subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail || session.user.email || undefined,
      metadata: { workspaceId },
    });
    customerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings/billing?canceled=1`,
    metadata: { workspaceId },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        workspaceId,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: "CANCELED",
      },
    });
  } else if (!subscription.stripeCustomerId) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId },
    });
  }

  return checkoutSession.url;
}

export async function createCustomerPortalSession({ workspaceId }: { workspaceId: string }) {
  const session = await requireUserSession();
  if (!stripe) throw new Error("Stripe is not configured.");
  await requireWorkspaceMembership(session.user.id, workspaceId);

  const subscription = await getWorkspaceSubscription(workspaceId);
  if (!subscription?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this workspace.");
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings/billing`,
  });

  return portal.url;
}
