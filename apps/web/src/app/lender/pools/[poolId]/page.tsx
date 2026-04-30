import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceType } from "@/lib/onboarding-status";
import { LoanPoolService } from "@/lib/services/loan-pool.service";
import {
  addDealToPoolAction,
  finalizeAiPoolingDecisionAction,
  generatePoolPackageAction,
  removeDealFromPoolAction,
  runAiPoolingReviewAction,
  transitionPoolAction,
} from "@/app/lender/pools/actions";
import { LoanPoolType } from "@/generated/prisma";

export default async function LoanPoolDetailPage({ params }: { params: Promise<{ poolId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ws = await getWorkspaceType(session.user.workspaceId);
  if (ws !== "LENDER") redirect("/dashboard");

  const { poolId } = await params;
  const pool = await LoanPoolService.getForLender(poolId, session.user.workspaceId);
  if (!pool) {
    redirect("/lender/pools");
  }

  const aiReview = (() => {
    const raw = (pool.filterCriteriaJson ?? {}) as Record<string, unknown>;
    return (raw.aiPoolingReview ?? null) as
      | {
          reviewedAt?: string;
          primeCount?: number;
          subprimeCount?: number;
          otherCount?: number;
          recommendedBucket?: string;
          recommendationSummary?: string;
        }
      | null;
  })();

  return (
    <div className="ds-section-shell">
      <Link href="/lender/pools" className="btn btn-secondary">
        All pools
      </Link>
      <h1 style={{ marginTop: "1rem" }}>{pool.poolName}</h1>
      <p style={{ color: "var(--muted)" }}>
        Segment: <strong>{pool.poolType}</strong> · Status: <strong>{pool.status}</strong> · Integrity:{" "}
        <strong>{pool.poolIntegrityStatus}</strong> · Audit: <strong>{pool.auditStatus}</strong>
      </p>
      {pool.description ? <p>{pool.description}</p> : null}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Pool lifecycle</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <form action={transitionPoolAction}>
            <input type="hidden" name="poolId" value={poolId} />
            <input type="hidden" name="intent" value="active" />
            <button type="submit" className="btn btn-secondary">
              Mark active
            </button>
          </form>
          <form action={transitionPoolAction}>
            <input type="hidden" name="poolId" value={poolId} />
            <input type="hidden" name="intent" value="ready" />
            <button type="submit" className="btn btn-secondary">
              Ready for sale
            </button>
          </form>
          <form action={transitionPoolAction}>
            <input type="hidden" name="poolId" value={poolId} />
            <input type="hidden" name="intent" value="sold" />
            <button type="submit" className="btn btn-secondary">
              Mark sold
            </button>
          </form>
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>AI market distribution + human final approval</h2>
        <p style={{ color: "var(--muted)", maxWidth: "56rem" }}>
          AI verifies package readiness and recommends distribution between prime, subprime, and other markets. Lender rep
          gives final approval or hold. After approval, AI automation performs downstream packaging and sale preparation.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.5rem" }}>
          <form
            action={async () => {
              "use server";
              await runAiPoolingReviewAction(poolId);
            }}
          >
            <button type="submit" className="btn">
              Run AI pooling review
            </button>
          </form>
        </div>
        {aiReview ? (
          <div className="card" style={{ marginTop: "0.8rem" }}>
            <p style={{ margin: 0 }}>
              Prime: <strong>{aiReview.primeCount ?? 0}</strong> · Subprime: <strong>{aiReview.subprimeCount ?? 0}</strong>{" "}
              · Other markets: <strong>{aiReview.otherCount ?? 0}</strong>
            </p>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)" }}>
              Recommended bucket: <strong>{aiReview.recommendedBucket ?? "MIXED"}</strong>
            </p>
            {aiReview.recommendationSummary ? (
              <p style={{ margin: "0.45rem 0 0", color: "var(--muted)" }}>{aiReview.recommendationSummary}</p>
            ) : null}
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>No AI review run yet for this pool.</p>
        )}
        <div className="card" style={{ marginTop: "0.8rem" }}>
          <h3 style={{ marginTop: 0 }}>Final lender rep decision</h3>
          <form action={finalizeAiPoolingDecisionAction} style={{ display: "grid", gap: "0.6rem", maxWidth: "36rem" }}>
            <input type="hidden" name="poolId" value={poolId} />
            <label>
              Final market bucket arrangement
              <select name="finalBucket" className="ds-input" defaultValue={String(aiReview?.recommendedBucket ?? pool.poolType)}>
                {Object.values(LoanPoolType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision note (optional)
              <textarea
                name="note"
                className="ds-input"
                rows={2}
                placeholder="Optional context for approval or hold."
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="submit" name="decision" value="APPROVE" className="btn">
                Final approve and let AI execute
              </button>
              <button type="submit" name="decision" value="HOLD" className="btn btn-secondary">
                Put on hold
              </button>
            </div>
          </form>
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Add funded deal</h2>
        <form
          action={async (formData: FormData) => {
            "use server";
            const dealId = String(formData.get("dealId") ?? "").trim();
            if (dealId) await addDealToPoolAction(poolId, dealId);
          }}
          style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
        >
          <label style={{ flex: 1 }}>
            Deal ID
            <input name="dealId" required className="ds-input" placeholder="cuid…" />
          </label>
          <button type="submit" className="btn">
            Add to pool
          </button>
        </form>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Loans in pool ({pool.deals.length})</h2>
        {pool.deals.length === 0 ? (
          <p>No loans yet.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Dealer</th>
                <th>Principal</th>
                <th>Contract hash</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pool.deals.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/lender/deals/${d.id}/review`}>{d.id.slice(0, 10)}…</Link>
                  </td>
                  <td>{d.dealer.name}</td>
                  <td>
                    {d.financials
                      ? Number(d.financials.amountFinanced).toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        })
                      : "—"}
                  </td>
                  <td style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>
                    {d.authoritativeContract?.authoritativeContractHash?.slice(0, 16) ?? "—"}…
                  </td>
                  <td>
                    <form
                      action={async () => {
                        "use server";
                        await removeDealFromPoolAction(poolId, d.id);
                      }}
                    >
                      <button type="submit" className="btn btn-secondary">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Pool package (placeholder)</h2>
        <p style={{ color: "var(--muted)" }}>
          Generates a JSON manifest + custodial object key for auditors / downstream investors (export formats later).
        </p>
        <form
          action={async () => {
            "use server";
            await generatePoolPackageAction(poolId);
          }}
        >
          <button type="submit" className="btn">
            Generate pool package
          </button>
        </form>
        {pool.lastPackageStorageKey ? (
          <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
            Last package key: <code>{pool.lastPackageStorageKey}</code>
          </p>
        ) : null}
      </section>
    </div>
  );
}
