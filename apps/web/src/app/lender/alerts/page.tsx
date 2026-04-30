import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

export default async function LenderAlertsPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/alerts");
  const lenderId = session.user.workspaceId;
  const alerts = await LenderOpsService.listAlerts(lenderId);
  const openAlerts = alerts.filter((a) => String((a as { status?: string }).status ?? "").toUpperCase() !== "RESOLVED");
  const critical = openAlerts.filter((a) => String((a as { severity?: string }).severity ?? "").toUpperCase() === "CRITICAL").length;
  const warning = openAlerts.filter((a) => String((a as { severity?: string }).severity ?? "").toUpperCase() === "WARNING").length;

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Alerts</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Operational alert panel for missing title/registration/insurance/disclosures, credit-report-required conditions,
        contract lock/governing copy gaps, assignment trail gaps, overdue dealer responses, and incomplete pool packages.
      </p>
      <div className="ds-dashboard-bottom-grid">
        <div className="card">
          <p className="ds-card-title">Critical open</p>
          <h2>{critical}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Warning open</p>
          <h2>{warning}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Total open</p>
          <h2>{openAlerts.length}</h2>
        </div>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        {openAlerts.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No open lender alerts.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1rem" }}>
            {openAlerts.map((alert) => (
              <li key={alert.id} style={{ marginBottom: "0.45rem" }}>
                <Link href={alert.dealId ? `/lender/deal-intake/${alert.dealId}` : "/lender/deal-intake"}>{alert.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn btn-secondary" href="/lender/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
