import Link from "next/link";
import { auth } from "@/lib/auth";
import { computeDealerDashboardMetrics, isAiComplianceAlert, type DealerDashboardDealRow } from "@/lib/dealer-dashboard-metrics";
import { DEALER_DISCLOSURE_BLOCKED_CAPABILITIES } from "@/lib/dealer-disclosure-gate";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasUploadedDealerOpeningDisclosure } from "@/lib/onboarding-status";
import { DealService } from "@/lib/services/deal.service";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export default async function DealerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer");
  const dealerId = session.user.workspaceId;
  const disclosureOk = await hasUploadedDealerOpeningDisclosure(dealerId);

  let deals: DealerDashboardDealRow[] = [];
  let lenderAccessRequests: Awaited<ReturnType<typeof DealerLenderLinkService.getPendingAccessRequestsForDealer>> = [];
  let openAlerts: Awaited<ReturnType<typeof prisma.dealAlert.findMany>> = [];
  let recentNotifications: Awaited<ReturnType<typeof prisma.notification.findMany>> = [];
  let dataWarning: string | null = null;

  try {
    const [d, req, al, note] = await Promise.all([
      DealService.listDealsForDealerDashboard(dealerId),
      DealerLenderLinkService.getPendingAccessRequestsForDealer(dealerId),
      prisma.dealAlert.findMany({
        where: {
          status: "OPEN",
          deal: { dealerId },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.findMany({
        where: { workspaceId: dealerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
    deals = d;
    lenderAccessRequests = req;
    openAlerts = al;
    recentNotifications = note;
  } catch (error) {
    console.error("[DealSeal] Dealer dashboard data fallback", error);
    dataWarning = "Some dashboard data is temporarily unavailable. You can still open the disclosure gate and settings.";
  }

  const metrics = computeDealerDashboardMetrics(deals);
  const aiComplianceAlerts = openAlerts.filter((a) => isAiComplianceAlert(a.type, a.severity));
  const unreadNotes = recentNotifications.filter((n) => !n.isRead);

  return (
    <div className="ds-section-shell ds-dashboard-page" style={{ padding: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Dealer dashboard</h1>
        {disclosureOk ? (
          <Link className="btn" href="/dealer/deals/new" style={{ fontWeight: 700 }}>
            Start new deal
          </Link>
        ) : (
          <Link className="btn btn-secondary" href="/dealer/disclosure-gate">
            Unlock deal work — disclosure gate
          </Link>
        )}
      </div>

      {!disclosureOk ? (
        <div
          className="card"
          style={{
            borderColor: "var(--accent, #38bdf8)",
            background: "rgba(56, 189, 248, 0.08)",
          }}
        >
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Workspace opening disclosure — required first lock
          </p>
          <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            Upload the workspace opening disclosure to enable buyer/vehicle/numbers, contracts, documents, and lender
            submit. Until then:
          </p>
          <ul
            style={{
              margin: "0 0 0.75rem",
              paddingLeft: "1.2rem",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
            }}
          >
            {DEALER_DISCLOSURE_BLOCKED_CAPABILITIES.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <Link className="btn" href="/dealer/disclosure-gate">
            Open disclosure gate
          </Link>
        </div>
      ) : null}

      {dataWarning ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>{dataWarning}</p>
      ) : null}

      {/* Primary metrics */}
      <div
        className="ds-dashboard-metrics"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        <div className="card">
          <p className="ds-card-title">Active deals</p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.75rem" }}>{metrics.activeDeals}</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>Excludes consummated</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Deals needing documents</p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.75rem" }}>{metrics.dealsNeedingDocuments}</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>Structuring / upload stages</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Pending lender submissions</p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.75rem" }}>{metrics.pendingLenderSubmissions}</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>With lender for review</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Lender access requests</p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.75rem" }}>{lenderAccessRequests.length}</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>Awaiting approval</p>
        </div>
      </div>

      {/* R / Y / G compliance health */}
      <div className="card" style={{ marginTop: 0 }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Deal status — compliance (red / yellow / green)
        </p>
        <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.85rem" }}>
          Counts by <code>complianceStatus</code> across your open pipeline.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <div
            className="card"
            style={{
              margin: 0,
              flex: "1 1 140px",
              borderLeft: "4px solid #dc2626",
              background: "rgba(220, 38, 38, 0.06)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>Red — blocked</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 800 }}>{metrics.dealStatusRyg.red}</p>
          </div>
          <div
            className="card"
            style={{
              margin: 0,
              flex: "1 1 140px",
              borderLeft: "4px solid #ca8a04",
              background: "rgba(202, 138, 4, 0.08)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>Yellow — warning</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 800 }}>{metrics.dealStatusRyg.yellow}</p>
          </div>
          <div
            className="card"
            style={{
              margin: 0,
              flex: "1 1 140px",
              borderLeft: "4px solid #16a34a",
              background: "rgba(22, 163, 74, 0.06)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>Green — compliant</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 800 }}>{metrics.dealStatusRyg.green}</p>
          </div>
        </div>
      </div>

      <div
        className="ds-dashboard-main-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {/* Calendar */}
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Calendar
          </p>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            Funding targets, disclosure follow-ups, and lender SLA milestones will surface here.
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>No events scheduled.</p>
          <Link className="btn btn-secondary" href="/dealer/calendar" style={{ marginTop: "0.75rem", display: "inline-block" }}>
            Open calendar
          </Link>
        </div>

        {/* Tasks / Alerts */}
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Tasks / alerts
          </p>
          <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Open deal alerts and recent workspace notifications.
          </p>
          {unreadNotes.length > 0 ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>
                Notifications ({unreadNotes.length} unread)
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
                {unreadNotes.slice(0, 5).map((n) => (
                  <li key={n.id} style={{ marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600 }}>{n.title}</span> — {n.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {openAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No open deal alerts.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
              {openAlerts.slice(0, 8).map((a) => {
                const dealState = deals.find((x) => x.id === a.dealId)?.state ?? "—";
                return (
                  <li key={a.id} style={{ marginBottom: "0.45rem" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: 4,
                        background: a.severity === "CRITICAL" ? "rgba(220,38,38,0.2)" : "rgba(202,138,4,0.2)",
                      }}
                    >
                      {a.severity}
                    </span>{" "}
                    {disclosureOk ? (
                      <Link href={`/dealer/deals/${a.dealId}`}>{a.title}</Link>
                    ) : (
                      <span>{a.title}</span>
                    )}
                    <span style={{ color: "var(--muted)" }}> · {dealState}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Missing disclosure warnings */}
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Missing disclosure warnings
          </p>
          {!disclosureOk ? (
            <p style={{ margin: "0 0 0.5rem", color: "#f87171", fontSize: "0.9rem" }}>
              Workspace opening disclosure is not on file — deal work is locked.
            </p>
          ) : null}
          {metrics.missingInitialDisclosureDeals.length === 0 && disclosureOk ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No deals waiting on initial disclosure.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
              {!disclosureOk ? (
                <li>
                  <Link href="/dealer/disclosure-gate">File workspace opening disclosure</Link>
                </li>
              ) : null}
              {metrics.missingInitialDisclosureDeals.map((d) => (
                <li key={d.id} style={{ marginBottom: "0.35rem" }}>
                  {disclosureOk ? (
                    <Link href={`/dealer/deals/${d.id}`}>
                      {d.id.slice(0, 12)}… — {d.state}
                    </Link>
                  ) : (
                    <span>
                      {d.id.slice(0, 12)}… — {d.state} (locked)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI compliance alerts */}
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            AI compliance alerts
          </p>
          <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Open alerts flagged as compliance- or AI-rule-driven, plus critical severity.
          </p>
          {aiComplianceAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>None open.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
              {aiComplianceAlerts.slice(0, 8).map((a) => (
                <li key={a.id} style={{ marginBottom: "0.45rem" }}>
                  <code style={{ fontSize: "0.75rem" }}>{a.type}</code> — {a.message}
                  {disclosureOk ? (
                    <>
                      {" "}
                      <Link href={`/dealer/deals/${a.dealId}`}>Deal</Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {lenderAccessRequests.length > 0 ? (
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Pending lender access requests
          </p>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Lender</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {lenderAccessRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.lender.name}</td>
                  <td>{r.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="btn btn-secondary" href="/dealer/lenders" style={{ marginTop: "0.75rem", display: "inline-block" }}>
            Lender network
          </Link>
        </div>
      ) : null}

      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        {disclosureOk ? (
          <>
            <Link className="btn btn-secondary" href="/dealer/deals">
              All deals
            </Link>
            <Link className="btn btn-secondary" href="/dealer/lenders">
              Lender network
            </Link>
            <Link className="btn btn-secondary" href="/dealer/tasks">
              Tasks
            </Link>
          </>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: "0.5rem" }}>
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
                <th>Compliance</th>
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
                  <td>{d.complianceStatus}</td>
                  <td>{d.lender.name}</td>
                  <td>
                    {disclosureOk ? (
                      <Link href={`/dealer/deals/${d.id}`}>Open</Link>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Locked</span>
                    )}
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
