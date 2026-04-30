import Link from "next/link";
import { auth } from "@/lib/auth";
import { listGradedDealersForLender } from "@/lib/services/counterparty-performance.service";
import { redirect } from "next/navigation";

function tierStyle(tier: "preferred" | "standard" | "watch"): { label: string; color: string } {
  switch (tier) {
    case "preferred":
      return { label: "Preferred partner", color: "#16a34a" };
    case "standard":
      return { label: "Standard", color: "#ca8a04" };
    default:
      return { label: "Watch list", color: "#dc2626" };
  }
}

export default async function LenderDealerPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/dealers/performance");
  const sp = await searchParams;
  const stateFilter = sp.state?.trim().toUpperCase() || "";

  const { rows, warning } = await listGradedDealersForLender(session.user.workspaceId);
  const filtered = stateFilter
    ? rows.filter(
        (r) =>
          r.primaryState.toUpperCase() === stateFilter ||
          r.operatingStates.some((s) => s.toUpperCase() === stateFilter),
      )
    : rows;

  const stateSet = new Set<string>();
  for (const r of rows) {
    if (r.primaryState && r.primaryState !== "—") stateSet.add(r.primaryState.toUpperCase());
    for (const s of r.operatingStates) stateSet.add(s.toUpperCase());
  }
  const states = [...stateSet].sort();

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
        <h1 style={{ marginTop: 0 }}>Dealer partner grades</h1>
        <Link href="/lender/dealers" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          All dealers
        </Link>
      </div>
      <p style={{ color: "var(--muted)", maxWidth: 860, lineHeight: 1.6 }}>
        DealSeal scores each approved dealership on your book using recent deal flow: low problem rate (open alerts,
        blocked compliance, amendments), completed jacket quality on consummated deals, volume, and cycle-time to
        consummation. Use it to see who is performing cleanly in each state—preferred partners rise to the top for
        sourcing and capacity planning.
      </p>
      {warning ? <p style={{ color: "#fecaca" }}>{warning}</p> : null}

      {states.length > 0 ? (
        <div className="row" style={{ flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Filter by state:</span>
          <Link
            href="/lender/dealers/performance"
            className={!stateFilter ? "btn" : "btn btn-secondary"}
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
          >
            All
          </Link>
          {states.map((st) => (
            <Link
              key={st}
              href={`/lender/dealers/performance?state=${encodeURIComponent(st)}`}
              className={stateFilter === st ? "btn" : "btn btn-secondary"}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
            >
              {st}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: "1rem", overflow: "auto" }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Dealer</th>
              <th>State / footprint</th>
              <th>Grade</th>
              <th>System tier</th>
              <th>Problem-free</th>
              <th>Jacket</th>
              <th>Volume</th>
              <th>Cycle</th>
              <th>Deals (90d)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const ts = tierStyle(r.preferredTier);
              return (
                <tr key={r.dealerId}>
                  <td>
                    <strong>{r.dealerName}</strong>
                  </td>
                  <td style={{ fontSize: "0.88rem" }}>
                    {r.primaryState}
                    {r.operatingStates.length > 1 ? (
                      <span style={{ color: "var(--muted)" }}> · {r.operatingStates.slice(0, 4).join(", ")}</span>
                    ) : null}
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{r.grade}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}> ({r.overallScore})</span>
                  </td>
                  <td style={{ color: ts.color, fontSize: "0.85rem", fontWeight: 600 }}>{ts.label}</td>
                  <td>{r.problemFreeScore}</td>
                  <td>{r.jacketScore}</td>
                  <td>{r.volumeScore}</td>
                  <td>{r.cycleScore}</td>
                  <td>{r.dealCount}</td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ color: "var(--muted)" }}>
                  {stateFilter ? `No approved dealers match state ${stateFilter} in the current window.` : "No graded dealers yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "var(--muted)", maxWidth: 800 }}>
        Scores use a 90-day rolling window on your lender workspace. Jacket completeness looks for key closing document
        types on consummated deals. Credit market segments for your counterparties are shown on the dealer-facing lender
        scorecard.
      </p>
    </div>
  );
}
