import Link from "next/link";
import { auth } from "@/lib/auth";
import { listGradedLendersForDealer } from "@/lib/services/counterparty-performance.service";
import { redirect } from "next/navigation";

function tierLabel(t: "lead" | "capable" | "developing"): { text: string; color: string } {
  switch (t) {
    case "lead":
      return { text: "Lead proficiency", color: "#16a34a" };
    case "capable":
      return { text: "Capable", color: "#ca8a04" };
    default:
      return { text: "Developing", color: "#94a3b8" };
  }
}

export default async function DealerLenderPerformancePage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/lenders/performance");

  const { rows, warning } = await listGradedLendersForDealer(session.user.workspaceId);

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
        <h1 style={{ marginTop: 0 }}>Lender proficiency by market</h1>
        <Link href="/dealer/lenders" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Lender network
        </Link>
      </div>
      <p style={{ color: "var(--muted)", maxWidth: 860, lineHeight: 1.6 }}>
        See how each approved lender performs on <strong>your</strong> deals, split by prime, subprime, and
        uncategorized flow. Scores emphasize clean execution (fewer open problems and amendments), complete deal
        jackets at consummation, throughput, and time-to-consummation—so you can route paper to lenders who are strongest
        in each credit market and licensed geography.
      </p>
      {warning ? <p style={{ color: "#fecaca" }}>{warning}</p> : null}

      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        {rows.map((row) => (
          <div key={row.lenderId} className="card">
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{row.lenderName}</h2>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Licensed states: {row.licensedStates.length ? row.licensedStates.join(", ") : "—"}
                </p>
              </div>
            </div>
            {row.bySegment.length === 0 ? (
              <p style={{ margin: "0.75rem 0 0", color: "var(--muted)" }}>
                No scored deal activity in the last 90 days for this lender.
              </p>
            ) : (
              <table className="ds-table" style={{ marginTop: "0.75rem" }}>
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Grade</th>
                    <th>Tier</th>
                    <th>Problem-free</th>
                    <th>Jacket</th>
                    <th>Volume</th>
                    <th>Cycle</th>
                    <th>Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {row.bySegment.map((s) => {
                    const tl = tierLabel(s.proficiencyTier);
                    return (
                      <tr key={s.segment}>
                        <td style={{ fontWeight: 600 }}>{s.segment}</td>
                        <td>
                          <span style={{ fontWeight: 800 }}>{s.grade}</span>{" "}
                          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>({s.overallScore})</span>
                        </td>
                        <td style={{ color: tl.color, fontSize: "0.85rem", fontWeight: 600 }}>{tl.text}</td>
                        <td>{s.problemFreeScore}</td>
                        <td>{s.jacketScore}</td>
                        <td>{s.volumeScore}</td>
                        <td>{s.cycleScore}</td>
                        <td>{s.segmentDealCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--muted)" }}>No approved lenders to score yet. Request access from the lender network page.</p>
            <Link href="/dealer/lenders" className="btn" style={{ marginTop: "0.75rem", display: "inline-block" }}>
              Lender network
            </Link>
          </div>
        ) : null}
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "var(--muted)", maxWidth: 800 }}>
        Segment labels use buyer credit tier when present, with a conservative amount-financed fallback. UNKNOWN captures
        deals without enough structure to classify—still scored, but review raw deal data for placement decisions.
      </p>
    </div>
  );
}
