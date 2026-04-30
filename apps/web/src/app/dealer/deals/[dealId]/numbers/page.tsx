import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealNumbersPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);
  const f = deal.financials;

  return (
    <div className="ds-section-shell" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Numbers</h2>
      {!f ? (
        <p style={{ color: "var(--muted)" }}>No financials on file.</p>
      ) : (
        <dl
          className="ds-form-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}
        >
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Amount financed</dt>
            <dd style={{ margin: "0.25rem 0 0" }}>{String(f.amountFinanced)}</dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "0.8rem" }}>LTV / Max LTV</dt>
            <dd style={{ margin: "0.25rem 0 0" }}>
              {String(f.ltv)} / {String(f.maxLtv)}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Taxes / Fees</dt>
            <dd style={{ margin: "0.25rem 0 0" }}>
              {String(f.taxes)} / {String(f.fees)}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "0.8rem" }}>GAP / Warranty</dt>
            <dd style={{ margin: "0.25rem 0 0" }}>
              {String(f.gap)} / {String(f.warranty)}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Total sale price</dt>
            <dd style={{ margin: "0.25rem 0 0" }}>{String(f.totalSalePrice)}</dd>
          </div>
        </dl>
      )}
      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/dealer/deals/${dealId}`} className="btn btn-secondary">
          Full deal workspace
        </Link>
      </p>
    </div>
  );
}
