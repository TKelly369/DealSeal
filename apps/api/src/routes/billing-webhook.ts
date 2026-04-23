import type { Request, Response } from "express";
import type Stripe from "stripe";
import type { SubscriptionTier as Tier } from "@prisma/client";
import type { Env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { getStripe, verifyStripeWebhook } from "../services/billing-service.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
function tierFromPriceId(priceId: string | undefined): Tier {
  if (!priceId) return "STARTER";
  if (priceId.toLowerCase().includes("ent")) return "ENTERPRISE";
  if (priceId.toLowerCase().includes("prof")) return "PROFESSIONAL";
  return "PROFESSIONAL";
}

export function createStripeWebhookHandler(env: Env) {
  return function stripeWebhook(req: Request, res: Response): void {
    void (async () => {
      const stripe = getStripe(env);
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        throw new HttpError(501, "Webhook not configured", "STRIPE_DISABLED");
      }
      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        throw new HttpError(400, "Missing signature", "STRIPE_SIG");
      }
      const event = verifyStripeWebhook(
        stripe,
        req.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );

      switch (event.type) {
        case "invoice.paid": {
          const inv = event.data.object as Stripe.Invoice;
          if (inv.id) {
            await prisma.invoice.updateMany({
              where: { stripeInvoiceId: inv.id },
              data: { status: "PAID", paidAt: new Date() },
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const inv = event.data.object as Stripe.Invoice;
          if (inv.id) {
            logger.warn("invoice_payment_failed", { stripeInvoiceId: inv.id });
            await prisma.invoice.updateMany({
              where: { stripeInvoiceId: inv.id },
              data: { status: "OPEN" },
            });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const s = event.data.object as Stripe.Subscription;
          const customer = typeof s.customer === "string" ? s.customer : s.customer.id;
          const subRow = await prisma.billingSubscription.findFirst({
            where: { OR: [{ stripeSubId: s.id }, { stripeCustomerId: customer }] },
          });
          if (subRow) {
            const firstItem = s.items.data[0];
            const priceId = firstItem?.price?.id;
            const tier =
              s.status === "canceled" || s.status === "incomplete_expired"
                ? "STARTER"
                : tierFromPriceId(priceId);
            await prisma.billingSubscription.update({
              where: { id: subRow.id },
              data: {
                stripeSubId: s.id,
                stripeCustomerId: customer,
                status: s.status,
                currentPeriodEnd: s.current_period_end
                  ? new Date(s.current_period_end * 1000)
                  : null,
                tier,
              },
            });
            logger.info("subscription_sync", { orgId: subRow.orgId, status: s.status, tier });
          }
          break;
        }
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== "subscription" || !session.client_reference_id) {
            break;
          }
          const orgId = session.client_reference_id;
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (!orgId || !subId) break;
          const s = await stripe.subscriptions.retrieve(subId);
          const firstItem = s.items.data[0];
          const priceId = firstItem?.price.id;
          const customer = typeof s.customer === "string" ? s.customer : s.customer.id;
          const tier = tierFromPriceId(priceId);
          await prisma.billingSubscription.upsert({
            where: { orgId },
            create: {
              orgId,
              tier,
              status: s.status,
              stripeSubId: s.id,
              stripeCustomerId: customer,
              currentPeriodEnd: s.current_period_end
                ? new Date(s.current_period_end * 1000)
                : null,
            },
            update: {
              tier,
              status: s.status,
              stripeSubId: s.id,
              stripeCustomerId: customer,
              currentPeriodEnd: s.current_period_end
                ? new Date(s.current_period_end * 1000)
                : null,
            },
          });
          logger.info("checkout_session_completed", { orgId, subscription: s.id });
          break;
        }
        default: {
          logger.debug("stripe_webhook_unhandled", { type: event.type });
        }
      }

      res.json({ received: true });
    })().catch((err) => {
      if (err instanceof HttpError) {
        res.status(err.status).json({
          code: err.code,
          message: err.message,
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ code: "INTERNAL", message: "Error" });
    });
  };
}
