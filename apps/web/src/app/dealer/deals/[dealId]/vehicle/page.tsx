import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealVehiclePage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);
  const v = deal.vehicle;

  return (
    <div className="ds-section-shell" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Vehicle</h2>
      {!v ? (
        <p style={{ color: "var(--muted)" }}>No vehicle attached to this deal.</p>
      ) : (
        <div className="card">
          <p style={{ margin: 0, fontWeight: 600 }}>
            {v.year} {v.make} {v.model}
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>VIN: {v.vin}</p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
            Mileage: {v.mileage.toLocaleString()} · {v.condition}
          </p>
        </div>
      )}
      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/dealer/deals/${dealId}`} className="btn btn-secondary">
          Full deal workspace
        </Link>
      </p>
    </div>
  );
}
