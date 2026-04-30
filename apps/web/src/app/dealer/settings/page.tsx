import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DealerSettingsHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/settings");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Dealer settings</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Workspace profile, billing, API keys, and integrations use the shared settings area. Quick links below.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <li>
          <Link href="/settings/profile">Profile</Link>
        </li>
        <li>
          <Link href="/settings/workspace">Workspace</Link>
        </li>
        <li>
          <Link href="/settings/billing">Billing</Link>
        </li>
        <li>
          <Link href="/settings/api-keys">API keys &amp; webhooks</Link>
        </li>
        <li>
          <Link href="/dealer/onboarding">Dealer onboarding</Link>
        </li>
      </ul>
    </div>
  );
}
