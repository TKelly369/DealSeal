import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LenderSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/settings");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender settings</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Workspace profile, integrations, and notifications will live here. Global account settings use the platform{" "}
        <strong>Settings</strong> area.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/settings">
          Platform settings
        </Link>
        <Link className="btn btn-secondary" href="/lender/rules">
          Credit &amp; document rules
        </Link>
      </div>
    </div>
  );
}
