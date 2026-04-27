"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession, createCustomerPortalSession } from "./actions";

export function BillingActionsClient({
  workspaceId,
  userEmail,
  hasActiveSubscription,
}: {
  workspaceId: string;
  userEmail: string;
  hasActiveSubscription: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runUpgrade = () => {
    startTransition(async () => {
      try {
        setError(null);
        const url = await createCheckoutSession({ workspaceId, userEmail });
        if (url) window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed");
      }
    });
  };

  const runPortal = () => {
    startTransition(async () => {
      try {
        setError(null);
        const url = await createCustomerPortalSession({ workspaceId });
        if (url) window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Portal launch failed");
      }
    });
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      {error ? (
        <p style={{ color: "#fecaca", marginTop: 0, marginBottom: "0.75rem" }}>
          {error}
        </p>
      ) : null}
      {hasActiveSubscription ? (
        <button type="button" disabled={pending} onClick={runPortal}>
          {pending ? "Opening..." : "Manage Subscription"}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={runUpgrade}>
          {pending ? "Redirecting..." : "Upgrade to Pro"}
        </button>
      )}
    </div>
  );
}
