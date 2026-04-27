import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealService } from "@/lib/services/deal.service";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export default async function DealerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dealer/dashboard");
  const dealerId = session.user.workspaceId;
  const [deals, links] = await Promise.all([
    DealService.listDealsForDealer(dealerId),
    DealerLenderLinkService.getActiveLinksForDealer(dealerId),
  ]);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Dealer Dashboard</h1>
      <div className="ds-dashboard-bottom-grid">
        <div className="card">
          <p className="ds-card-title">Active Deals</p>
          <h2>{deals.length}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Pending/Approved Links</p>
          <h2>{links.length}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Compliance Alerts</p>
          <h2>{deals.filter((d) => d.complianceStatus !== "COMPLIANT").length}</h2>
        </div>
      </div>
      <div className="row">
        <Link className="btn" href="/dealer/deals/new">
          New Deal
        </Link>
        <Link className="btn btn-secondary" href="/dealer/lenders">
          Lender Network
        </Link>
      </div>
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="ds-card-title">Your deals</p>
        {deals.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No deals yet.</p>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>State</th>
                <th>Lender</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{d.id}</td>
                  <td>{d.status}</td>
                  <td>{d.state}</td>
                  <td>{d.lender.name}</td>
                  <td>
                    <Link href={`/dealer/deals/${d.id}`}>Lifecycle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
