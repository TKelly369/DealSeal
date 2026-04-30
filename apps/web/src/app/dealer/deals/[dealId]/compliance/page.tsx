import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealCompliancePage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);
  const checks = deal.complianceChecks;

  return (
    <div className="ds-section-shell" style={{ maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>Compliance</h2>
      <p style={{ color: "var(--muted)" }}>
        Deal compliance flag: <strong>{deal.complianceStatus}</strong>
      </p>
      {checks.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No rule evaluations recorded on this row.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {checks.map((c) => (
            <li key={c.id} className="card" style={{ marginBottom: "0.65rem" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {c.ruleSet} · {c.status}
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>{c.explanation}</p>
              {c.affectedField ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Field: {c.affectedField} · {c.ruleSource}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/dealer/deals/${dealId}`} className="btn btn-secondary">
          Full deal workspace
        </Link>
      </p>
    </div>
  );
}
