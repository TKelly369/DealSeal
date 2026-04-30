import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealService } from "@/lib/services/deal.service";
import { getLenderPreferredDealersInTopStates } from "@/lib/services/counterparty-performance.service";
import { prisma } from "@/lib/db";
import {
  complianceRygForPipeline,
  dealNeedsDocumentsRow,
  dealPendingReview,
  isInLenderPipeline,
  newSubmissionsWindow,
  previousUtcDayRange,
  type LenderDashboardDealRow,
} from "@/lib/lender-dashboard-metrics";
import type { CalendarEventKind } from "@/generated/prisma";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

function MiniTable({
  rows,
  empty,
}: {
  rows: { id: string; primary: string; secondary: string; href: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>{empty}</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map((r) => (
        <li
          key={r.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            padding: "0.45rem 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <Link href={r.href} style={{ fontWeight: 600 }}>
              {r.primary}
            </Link>
            <span style={{ color: "var(--muted)", fontSize: "0.82rem", marginLeft: "0.35rem" }}>{r.secondary}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function LenderDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender");
  const lenderId = session.user.workspaceId;

  let deals: LenderDashboardDealRow[] = [];
  let dataWarning: string | null = null;
  let pendingLinks: { id: string; dealer: { name: string }; updatedAt: Date }[] = [];
  let upcomingEvents: {
    id: string;
    title: string;
    kind: CalendarEventKind;
    startsAt: Date;
    dealId: string | null;
  }[] = [];
  let fundingConditions: typeof upcomingEvents = [];
  let priorDayAlerts: {
    id: string;
    title: string;
    message: string;
    severity: string;
    createdAt: Date;
    dealId: string;
    deal: { dealer: { name: string } };
  }[] = [];
  let partnerHighlights: Awaited<ReturnType<typeof getLenderPreferredDealersInTopStates>> | null = null;
  let commandCenter = await LenderOpsService.getCommandCenterCounts(lenderId);
  let lenderTasks = await LenderOpsService.listTasks(lenderId);
  let opsAlerts = await LenderOpsService.listAlerts(lenderId);

  try {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const horizon = new Date(now.getTime() + 30 * 86_400_000);
    const { start: priorStart, end: priorEnd } = previousUtcDayRange(now);

    const [dealsResult, linksResult, calResult, fundingResult, alertsResult, highlightsResult] = await Promise.all([
      DealService.listDealsForLenderDashboard(lenderId),
      prisma.dealerLenderLink.findMany({
        where: { lenderId, status: "PENDING" },
        select: { id: true, updatedAt: true, dealer: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.calendarEvent.findMany({
        where: { workspaceId: lenderId, startsAt: { gte: startOfTodayUtc } },
        select: { id: true, title: true, kind: true, startsAt: true, dealId: true },
        orderBy: { startsAt: "asc" },
        take: 10,
      }),
      prisma.calendarEvent.findMany({
        where: {
          workspaceId: lenderId,
          kind: { in: ["FUNDING_TASK", "LENDER_CONDITION"] },
          startsAt: { gte: now, lte: horizon },
        },
        select: { id: true, title: true, kind: true, startsAt: true, dealId: true },
        orderBy: { startsAt: "asc" },
        take: 12,
      }),
      prisma.dealAlert.findMany({
        where: {
          deal: { lenderId },
          createdAt: { gte: priorStart, lte: priorEnd },
        },
        select: {
          id: true,
          title: true,
          message: true,
          severity: true,
          createdAt: true,
          dealId: true,
          deal: { select: { dealer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      getLenderPreferredDealersInTopStates(lenderId),
    ]);

    deals = dealsResult;
    pendingLinks = linksResult;
    upcomingEvents = calResult;
    fundingConditions = fundingResult;
    priorDayAlerts = alertsResult;
    partnerHighlights = highlightsResult;
  } catch (error) {
    console.error("[DealSeal] Lender dashboard data fallback", error);
    dataWarning = "Some dashboard data is temporarily unavailable. You can still open deal intake and calendars.";
  }

  const pipeline = deals.filter(isInLenderPipeline);
  const ryg = complianceRygForPipeline(deals);
  const newSubs = newSubmissionsWindow(deals, 14);
  const pendingReviews = deals.filter(dealPendingReview);
  const missingDocs = deals.filter(dealNeedsDocumentsRow);

  const todoItems: { key: string; label: string; href: string; count: number }[] = [];
  if (pendingLinks.length > 0) {
    todoItems.push({
      key: "approvals",
      label: "Dealer approval requests",
      href: "/lender/dealers/approval-queue",
      count: pendingLinks.length,
    });
  }
  if (pendingReviews.length > 0) {
    todoItems.push({
      key: "reviews",
      label: "Deals pending your review",
      href: "/lender/deal-intake",
      count: pendingReviews.length,
    });
  }
  if (missingDocs.length > 0) {
    todoItems.push({
      key: "docs",
      label: "Deals with document gaps",
      href: "/lender/deal-intake",
      count: missingDocs.length,
    });
  }
  if (ryg.red > 0) {
    todoItems.push({
      key: "blocked",
      label: "Compliance-blocked deals",
      href: "/lender/alerts",
      count: ryg.red,
    });
  }
  if (fundingConditions.length > 0) {
    todoItems.push({
      key: "funding",
      label: "Funding / condition deadlines (30d)",
      href: "/lender/calendar",
      count: fundingConditions.length,
    });
  }

  const kindLabel = (k: CalendarEventKind) =>
    ({
      FOLLOW_UP: "Follow-up",
      DOCUMENT_REMINDER: "Document",
      FUNDING_TASK: "Funding",
      CUSTOMER_SIGNING: "Signing",
      LENDER_CONDITION: "Condition",
      TITLE_REGISTRATION: "Title",
      REPO_REPLEVIN_REVIEW: "Repo/replevin",
      INTERNAL_NOTE: "Internal note",
      ALERT_REMINDER: "Alert reminder",
    })[k] ?? k;
  const unresolvedOpsAlerts = opsAlerts.filter((a) => String((a as { status?: string }).status ?? "").toUpperCase() !== "RESOLVED");
  const dealSpecificRows = pipeline
    .slice()
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 12);
  const complianceTone = (status: LenderDashboardDealRow["complianceStatus"]) =>
    status === "BLOCKED" ? "#f87171" : status === "WARNING" ? "#fbbf24" : "#86efac";

  return (
    <div className="ds-section-shell">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Lender dashboard</h1>
        <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          {pipeline.length} active in pipeline · {deals.length} total in book
        </span>
      </div>
      <section style={{ marginTop: "1rem" }} aria-label="Workflow lens separator">
        <p style={{ color: "var(--muted)", margin: 0 }}>
          <strong>Overall workflow stats</strong> show portfolio-level throughput and pressure.{" "}
          <strong>Deal-specific workflow stats</strong> show the flow state for each individual file.
        </p>
      </section>

      <section style={{ marginTop: "1.25rem" }} aria-label="Overall workflow stats">
        <h2 className="ds-card-title" style={{ margin: "0 0 0.75rem" }}>
          Overall workflow stats
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 0, maxWidth: 780 }}>
          Portfolio-wide signal across your full lender pipeline, used to monitor intake flow, risk pressure, and funding readiness.
        </p>
      </section>

      <section style={{ marginTop: "1rem" }} aria-label="Compliance status">
        <h2 className="ds-card-title" style={{ margin: "0 0 0.75rem" }}>
          Deal status (red / yellow / green)
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 0, maxWidth: 720 }}>
          Based on each deal&apos;s <strong>compliance status</strong> for your active (non-consummated) pipeline.
        </p>
        <div
          className="ds-dashboard-bottom-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: "0.75rem" }}
        >
          <div className="card" style={{ borderLeft: "4px solid #f87171" }}>
            <p className="ds-card-title" style={{ marginTop: 0 }}>
              Red (blocked)
            </p>
            <h2 style={{ margin: "0.25rem 0 0" }}>{ryg.red}</h2>
          </div>
          <div className="card" style={{ borderLeft: "4px solid #facc15" }}>
            <p className="ds-card-title" style={{ marginTop: 0 }}>
              Yellow (warning)
            </p>
            <h2 style={{ margin: "0.25rem 0 0" }}>{ryg.yellow}</h2>
          </div>
          <div className="card" style={{ borderLeft: "4px solid #4ade80" }}>
            <p className="ds-card-title" style={{ marginTop: 0 }}>
              Green (compliant)
            </p>
            <h2 style={{ margin: "0.25rem 0 0" }}>{ryg.green}</h2>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "1.25rem" }} aria-label="Daily work command center">
        <h2 className="ds-card-title" style={{ margin: "0 0 0.75rem" }}>
          Daily work command center
        </h2>
        <div
          className="ds-dashboard-bottom-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", marginTop: "0.75rem" }}
        >
          <div className="card"><p className="ds-card-title">New dealer submissions</p><h2>{commandCenter.newDealerSubmissions}</h2></div>
          <div className="card"><p className="ds-card-title">Pending review</p><h2>{commandCenter.dealsPendingReview}</h2></div>
          <div className="card"><p className="ds-card-title">Ready for funding</p><h2>{commandCenter.dealsReadyForFunding}</h2></div>
          <div className="card"><p className="ds-card-title">Missing dealer items</p><h2>{commandCenter.missingDealerItems}</h2></div>
          <div className="card"><p className="ds-card-title">Post-funding follow-up</p><h2>{commandCenter.postFundingFollowUps}</h2></div>
          <div className="card"><p className="ds-card-title">Enforcement warnings</p><h2>{commandCenter.enforcementWarnings}</h2></div>
          <div className="card"><p className="ds-card-title">Pooling ready</p><h2>{commandCenter.poolingReadyDeals}</h2></div>
          <div className="card"><p className="ds-card-title">Secondary market alerts</p><h2>{commandCenter.secondaryMarketAlerts}</h2></div>
        </div>
      </section>

      <section style={{ marginTop: "1.25rem" }} aria-label="Deal-specific workflow stats">
        <h2 className="ds-card-title" style={{ margin: "0 0 0.75rem" }}>
          Deal-specific workflow stats
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 0, maxWidth: 820 }}>
          Individual deal flow to separate file-level execution from portfolio totals. Use this to see exactly which deal is moving, blocked, or missing documents.
        </p>
        <div className="card" style={{ marginTop: "0.75rem" }}>
          {dealSpecificRows.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>No active individual deals in workflow.</p>
          ) : (
            <table className="ds-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Dealer</th>
                  <th>Workflow stage</th>
                  <th>Compliance</th>
                  <th>Docs</th>
                  <th>Amendments</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {dealSpecificRows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/lender/deal-intake/${d.id}`}>
                        <code>{d.id.slice(0, 10)}…</code>
                      </Link>
                    </td>
                    <td>{d.dealer.name}</td>
                    <td>{d.status.replace(/_/g, " ")}</td>
                    <td>
                      <span style={{ color: complianceTone(d.complianceStatus), fontWeight: 700 }}>
                        {d.complianceStatus}
                      </span>
                    </td>
                    <td>{d._count.generatedDocuments}</td>
                    <td>{d.amendments.length}</td>
                    <td>{d.updatedAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem" }}>
            <Link href="/lender/deal-intake">Open full deal workflow queue →</Link>
          </p>
        </div>
      </section>

      {partnerHighlights && !partnerHighlights.warning ? (
        <section style={{ marginTop: "1.5rem" }} aria-label="Preferred dealers by top states">
          <h2 className="ds-card-title" style={{ margin: "0 0 0.75rem" }}>
            Top volume states &amp; preferred dealers
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 0, maxWidth: 820 }}>
            States are ranked by your deal flow in the last 90 days. Preferred dealers meet DealSeal clean-deal scoring
            in those markets—strong jackets, fewer open problems, and healthy cycle times.
          </p>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              marginTop: "0.85rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            }}
          >
            <div className="card" style={{ margin: 0 }}>
              <p className="ds-card-title" style={{ marginTop: 0 }}>
                Your top states
              </p>
              {partnerHighlights.topStates.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                  No state footprint yet—complete onboarding or book deals to populate this map.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {partnerHighlights.topStates.map((s) => (
                    <li key={s.code}>
                      <Link
                        href={`/lender/dealers/performance?state=${encodeURIComponent(s.code)}`}
                        className="btn btn-secondary"
                        style={{
                          fontSize: "0.85rem",
                          padding: "0.4rem 0.65rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <strong>{s.code}</strong>
                        <span style={{ color: "var(--muted)", fontWeight: 500 }}>{s.dealCount} deals</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
                <p className="ds-card-title" style={{ marginTop: 0 }}>
                  Preferred partners
                </p>
                <Link href="/lender/dealers/performance" style={{ fontSize: "0.82rem" }}>
                  Full scorecard →
                </Link>
              </div>
              {partnerHighlights.scopeNote === "bookwide_fallback" ? (
                <p style={{ margin: "0 0 0.65rem", fontSize: "0.8rem", color: "#fbbf24" }}>
                  None of your preferred dealers overlap the highlighted states yet—showing book-wide preferred partners.
                </p>
              ) : null}
              {partnerHighlights.scopeNote === "licensed_states_only" ? (
                <p style={{ margin: "0 0 0.65rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Using your licensed states until deal volume builds in the last 90 days.
                </p>
              ) : null}
              {partnerHighlights.preferredDealers.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                  No dealers in the preferred tier yet. As clean deals accumulate, top performers surface here.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {partnerHighlights.preferredDealers.map((d) => (
                    <li
                      key={d.dealerId}
                      style={{
                        padding: "0.5rem 0",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        gap: "0.35rem",
                        alignItems: "baseline",
                      }}
                    >
                      <div>
                        <strong>{d.dealerName}</strong>
                        <span style={{ color: "var(--muted)", fontSize: "0.82rem", marginLeft: "0.35rem" }}>
                          {d.primaryState}
                          {d.operatingStates.length > 1 ? ` +${d.operatingStates.length - 1}` : ""}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.85rem" }}>
                        <span style={{ fontWeight: 800 }}>{d.grade}</span>{" "}
                        <span style={{ color: "var(--muted)" }}>({d.overallScore})</span>
                        <span style={{ color: "var(--muted)", marginLeft: "0.35rem" }}>· 2nd green {d.secondGreenScore}</span>
                        <span style={{ color: "var(--muted)", marginLeft: "0.35rem" }}>· {d.dealCount} deals</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : partnerHighlights?.warning ? (
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.88rem" }}>{partnerHighlights.warning}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "1.25rem",
          marginTop: "1.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
        }}
      >
        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>Task widgets</h2>
          <ul style={{ margin: 0, paddingLeft: "1rem", lineHeight: 1.8 }}>
            <li><Link href="/lender/deal-intake">Review New Deals</Link></li>
            <li><Link href="/lender/funding">Funding Conditions</Link></li>
            <li><Link href="/lender/tasks">Missing Dealer Items</Link></li>
            <li><Link href="/lender/post-funding">Post-Funding Follow-Up</Link></li>
            <li><Link href="/lender/deal-intake">Contract Integrity Review</Link></li>
            <li><Link href="/lender/deal-intake">Assignment / Control Review</Link></li>
            <li><Link href="/lender/deal-intake">Custody / Document Completeness</Link></li>
            <li><Link href="/lender/enforcement-readiness">Enforcement Readiness</Link></li>
            <li><Link href="/lender/pools">Pooling Queue</Link></li>
            <li><Link href="/lender/secondary-market">Secondary Market Readiness</Link></li>
          </ul>
          <p style={{ marginTop: "0.75rem", color: "var(--muted)", fontSize: "0.82rem" }}>
            Open lender tasks: {lenderTasks.filter((t) => t.status !== "completed").length}
          </p>
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>Operational alerts</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Missing title/registration/insurance/disclosures, credit-report-required flags, contract lock and governance checks, assignment trail, and pool package completeness.
          </p>
          {unresolvedOpsAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>No unresolved operational alerts.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1rem" }}>
              {unresolvedOpsAlerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link href={a.dealId ? `/lender/deal-intake/${a.dealId}` : "/lender/alerts"}>
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/lender/alerts" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
              Alerts panel
            </Link>
          </p>
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            New dealer submissions
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Deals that entered your book in the last 14 days (excluding consummated).
          </p>
          <MiniTable
            empty="No new submissions in this window."
            rows={newSubs.slice(0, 8).map((d) => ({
              id: d.id,
              primary: d.dealer.name,
              secondary: `${d.status.replace(/_/g, " ")} · ${d.createdAt.toLocaleDateString()}`,
              href: `/lender/deal-intake/${d.id}`,
            }))}
          />
          {newSubs.length > 8 ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem" }}>
              <Link href="/lender/deal-intake">View full intake queue →</Link>
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Pending deal reviews
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            RISC / lender final stages and deals with amendment requests awaiting lender action.
          </p>
          <MiniTable
            empty="Nothing waiting for lender review."
            rows={pendingReviews.slice(0, 8).map((d) => ({
              id: d.id,
              primary: d.dealer.name,
              secondary: `${d.status.replace(/_/g, " ")}${d.amendments.length ? ` · ${d.amendments.length} amendment(s)` : ""}`,
              href: `/lender/deal-intake/${d.id}`,
            }))}
          />
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Deals missing documents
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Pipeline stages that typically require collateral, or disclosure accepted with no generated files yet.
          </p>
          <MiniTable
            empty="No document gaps flagged with current rules."
            rows={missingDocs.slice(0, 8).map((d) => ({
              id: d.id,
              primary: d.dealer.name,
              secondary: `${d.status.replace(/_/g, " ")} · ${d._count.generatedDocuments} doc(s)`,
              href: `/lender/deal-intake/${d.id}`,
            }))}
          />
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Funding conditions
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Calendar items tagged <strong>Funding</strong> or <strong>Lender condition</strong> in the next 30 days.
          </p>
          {fundingConditions.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No upcoming funding or condition deadlines.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {fundingConditions.map((ev) => (
                <li key={ev.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <strong>{ev.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: "0.35rem" }}>
                    {kindLabel(ev.kind)}
                  </span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    {ev.startsAt.toLocaleString()}
                    {ev.dealId ? (
                      <>
                        {" · "}
                        <Link href={`/lender/deal-intake/${ev.dealId}`}>Deal</Link>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: "0.75rem 0 0" }}>
            <Link href="/lender/calendar" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
              Full calendar
            </Link>
          </p>
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Dealer approval requests
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Pending dealer–lender link requests ({pendingLinks.length}).
          </p>
          <MiniTable
            empty="No pending approvals — you are caught up."
            rows={pendingLinks.slice(0, 8).map((l) => ({
              id: l.id,
              primary: l.dealer.name,
              secondary: `Requested · ${l.updatedAt.toLocaleDateString()}`,
              href: "/lender/dealers/approval-queue",
            }))}
          />
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Forms library
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Program PDFs, e-contract templates, and lender intake packages.
          </p>
          <Link href="/lender/forms" className="btn" style={{ marginTop: "0.5rem", display: "inline-block" }}>
            Open forms library
          </Link>
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            To-do list
          </h2>
          {todoItems.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No open items surfaced — nice work.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {todoItems.map((t) => (
                <li key={t.key} style={{ marginBottom: "0.45rem" }}>
                  <Link href={t.href}>
                    {t.label} ({t.count})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Calendar
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Next events starting today (UTC) onward.
          </p>
          {upcomingEvents.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No upcoming events. Add some in the calendar.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {upcomingEvents.map((ev) => (
                <li key={ev.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <strong>{ev.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginLeft: "0.35rem" }}>
                    {kindLabel(ev.kind)}
                  </span>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{ev.startsAt.toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: "0.75rem 0 0" }}>
            <Link href="/lender/calendar" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
              Manage calendar
            </Link>
          </p>
        </div>

        <div className="card">
          <h2 className="ds-card-title" style={{ marginTop: 0 }}>
            Alerts from previous workday
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
            Deal alerts created on the prior UTC calendar day across your book (math / legal pre-signature monitor and
            similar).
          </p>
          {priorDayAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>No alerts recorded that day.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {priorDayAlerts.map((a) => (
                <li key={a.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: a.severity === "CRITICAL" ? "#f87171" : "#fbbf24",
                    }}
                  >
                    {a.severity}
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.82rem", marginLeft: "0.35rem" }}>
                      {a.deal.dealer.name} · {a.createdAt.toLocaleString()}
                    </span>
                  </div>
                  {a.message ? (
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {a.message.length > 160 ? `${a.message.slice(0, 157)}…` : a.message}
                    </p>
                  ) : null}
                  <Link href={`/lender/deal-intake/${a.dealId}`} style={{ fontSize: "0.82rem" }}>
                    Open deal →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: "0.75rem 0 0" }}>
            <Link href="/lender/alerts" style={{ fontSize: "0.85rem" }}>
              Compliance &amp; alerts overview →
            </Link>
          </p>
        </div>
      </div>

      <div className="row" style={{ marginTop: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/lender/deal-intake" className="btn">
          Deal intake
        </Link>
        <Link href="/lender/assets" className="btn">
          Receivables
        </Link>
        <Link href="/lender/pools" className="btn">
          Loan pools
        </Link>
        <Link href="/lender/rules" className="btn btn-secondary">
          Rules
        </Link>
      </div>

      {dataWarning ? (
        <p style={{ marginTop: "0.8rem", color: "var(--muted)" }}>{dataWarning}</p>
      ) : null}
    </div>
  );
}
