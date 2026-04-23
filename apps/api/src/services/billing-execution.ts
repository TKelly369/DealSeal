import type { Env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { ensureStripeCustomer, getStripe } from "./billing-service.js";
import { getOrgDealEntitlements } from "./entitlements-service.js";

const DEFAULT_SUCCESS_PATH = "/billing?checkout=success";
const DEFAULT_CANCEL_PATH = "/billing?checkout=cancel";

/**
 * Customer Checkout for subscription; requires STRIPE_CHECKOUT_PRICE_ID when Stripe is on.
 */
export async function createCheckoutSessionForOrg(
  env: Env,
  orgId: string,
  input?: { successPath?: string; cancelPath?: string },
): Promise<{ url: string; id: string }> {
  const stripe = getStripe(env);
  if (!stripe) throw new HttpError(501, "Stripe not configured", "STRIPE_DISABLED");
  if (!env.STRIPE_CHECKOUT_PRICE_ID) {
    throw new HttpError(501, "STRIPE_CHECKOUT_PRICE_ID not set", "STRIPE_NO_PRICE");
  }
  const base =
    env.APP_PUBLIC_URL?.replace(/\/$/, "") ??
    (() => {
      throw new HttpError(501, "APP_PUBLIC_URL not set (needed for checkout)", "NO_PUBLIC_URL");
    })();
  const customerId = await ensureStripeCustomer(stripe, orgId);
  const successUrl = `${base}${input?.successPath ?? DEFAULT_SUCCESS_PATH}`;
  const cancelUrl = `${base}${input?.cancelPath ?? DEFAULT_CANCEL_PATH}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.STRIPE_CHECKOUT_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: orgId,
    metadata: { orgId },
  });
  if (!session.url) throw new HttpError(500, "Checkout did not return URL", "STRIPE_CHECKOUT");
  return { url: session.url, id: session.id };
}

export async function getBillingSubscriptionView(orgId: string): Promise<{
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  entitlements: Awaited<ReturnType<typeof getOrgDealEntitlements>>;
}> {
  const sub = await prisma.billingSubscription.findUnique({ where: { orgId } });
  const entitlements = await getOrgDealEntitlements(orgId);
  return {
    tier: sub?.tier ?? "STARTER",
    status: sub?.status ?? "unknown",
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    stripeSubId: sub?.stripeSubId ?? null,
    entitlements,
  };
}
