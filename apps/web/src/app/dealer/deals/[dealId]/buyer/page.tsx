import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealBuyerPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);
  const buyers = deal.parties.filter((p) => p.role === "BUYER" || p.role === "CO_BUYER");

  return (
    <div className="ds-section-shell" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Buyer</h2>
      <p style={{ color: "var(--muted)" }}>Parties on file for this deal.</p>
      {buyers.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No buyer or co-buyer recorded.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {buyers.map((p) => (
            <li key={p.id} className="card" style={{ marginBottom: "0.75rem" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {p.role}: {p.firstName} {p.lastName}
              </p>
              <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{p.address}</p>
              {p.creditTier ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>Credit tier: {p.creditTier}</p>
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
