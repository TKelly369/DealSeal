import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealSubmitPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);

  return (
    <div className="ds-section-shell" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Submit</h2>
      <p style={{ color: "var(--muted)" }}>
        Unsigned RISC upload, lender-final handoff, and package submission actions run from the main deal workspace
        (status-driven steps).
      </p>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p style={{ margin: 0 }}>
          <strong>Status:</strong> {deal.status}
        </p>
        <p style={{ margin: "0.5rem 0 0" }}>
          <strong>State:</strong> {deal.state}
        </p>
      </div>
      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/dealer/deals/${dealId}`} className="btn">
          Open workspace — submit steps
        </Link>
      </p>
    </div>
  );
}
