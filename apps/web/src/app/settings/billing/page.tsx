import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMembership, getWorkspaceSubscription } from "@/lib/dal";
import { BillingActionsClient } from "./BillingActionsClient";

export default async function SettingsBillingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/settings/billing");
  }

  const workspaceId = session.user.workspaceId;
  const membership = await getMembership(session.user.id, workspaceId);
  if (!membership) {
    throw new Error("Workspace access denied.");
  }

  const subscription = await getWorkspaceSubscription(workspaceId);

  const hasActiveSubscription = subscription?.status === "ACTIVE";

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Billing</h2>
      <p style={{ color: "var(--muted)" }}>Plan and consumption controls for your organization.</p>
      {hasActiveSubscription ? (
        <>
          <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>Current Plan: Pro</p>
          <p style={{ color: "var(--muted)", marginTop: "0.35rem" }}>
            Subscription status: {subscription?.status}{" "}
            {subscription?.stripeCurrentPeriodEnd
              ? `· Renews ${new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}`
              : ""}
          </p>
        </>
      ) : (
        <>
          <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>No active subscription</p>
          <p style={{ color: "var(--muted)", marginTop: "0.35rem" }}>
            Upgrade to Pro to unlock certified document governance and expanded workspace limits.
          </p>
        </>
      )}
      <BillingActionsClient
        workspaceId={workspaceId}
        userEmail={session.user.email ?? ""}
        hasActiveSubscription={hasActiveSubscription}
      />
    </div>
  );
}
