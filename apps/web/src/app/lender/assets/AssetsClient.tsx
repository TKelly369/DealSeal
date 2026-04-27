"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { addDealToPoolFormAction, approveAmendmentFormAction, rejectAmendmentFormAction } from "./actions";

export type AssetRow = {
  id: string;
  buyerName: string;
  amountFinanced: number | null;
  grade: string | null;
  secondaryMarketStatus: string;
  poolId: string | null;
  poolName: string | null;
  events: {
    id: string;
    eventType: string;
    transactionDate: string;
    fromEntityId: string;
    toEntityId: string;
  }[];
  activityEvents: {
    id: string;
    eventType: string;
    timestamp: string;
    actorRole: string;
    actorUserId: string;
    actorName: string | null;
    actorEmail: string | null;
  }[];
  pendingAmendments: {
    id: string;
    reason: string;
    createdAt: string;
  }[];
  instrument: {
    id: string;
    payToOrderOf: string;
    eNoteControlLocation: string | null;
  } | null;
  instrumentEvents: {
    id: string;
    transferType: string;
    transferDate: string;
    fromEntityId: string;
    toEntityId: string;
    endorsementLanguage: string | null;
  }[];
};

export type PoolOption = { id: string; poolName: string; poolType: string; status: string };

function SubmitLabel({ idle }: { idle: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving…" : idle}</>;
}

function AddToPoolForm({ dealId, pools }: { dealId: string; pools: PoolOption[] }) {
  if (pools.length === 0) {
    return <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No active pools</span>;
  }
  return (
    <form action={addDealToPoolFormAction} style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="dealId" value={dealId} />
      <select name="poolId" required className="btn btn-secondary" style={{ padding: "0.35rem 0.5rem", fontSize: "0.82rem" }}>
        {pools.map((p) => (
          <option key={p.id} value={p.id}>
            {p.poolName} ({p.poolType})
          </option>
        ))}
      </select>
      <button type="submit" className="btn" style={{ fontSize: "0.82rem", padding: "0.35rem 0.65rem" }}>
        <SubmitLabel idle="Add to pool" />
      </button>
    </form>
  );
}

function AmendmentDecisionForm({
  amendmentId,
  approve,
}: {
  amendmentId: string;
  approve: boolean;
}) {
  return (
    <form action={approve ? approveAmendmentFormAction : rejectAmendmentFormAction}>
      <input type="hidden" name="amendmentId" value={amendmentId} />
      <button
        type="submit"
        className={approve ? "btn" : "btn btn-secondary"}
        style={{ fontSize: "0.72rem", padding: "0.3rem 0.55rem" }}
      >
        {approve ? "Approve amendment" : "Reject"}
      </button>
    </form>
  );
}

const STATUS_LABEL: Record<string, string> = {
  HELD_FOR_INVESTMENT: "Held",
  AVAILABLE_FOR_SALE: "For sale",
  SOLD: "Sold",
};

export function AssetsClient({ deals, pools }: { deals: AssetRow[]; pools: PoolOption[] }) {
  const [auditForId, setAuditForId] = useState<string | null>(null);
  const auditDeal = useMemo(() => deals.find((d) => d.id === auditForId) ?? null, [deals, auditForId]);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Receivables &amp; pools</h1>
      <p style={{ color: "var(--muted)", maxWidth: "40rem" }}>
        Loans booked to your institution. Add paper to a pool when you are ready—assignment history stays on each deal.
      </p>

      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "0.5rem" }}>Deal</th>
              <th style={{ padding: "0.5rem" }}>Buyer</th>
              <th style={{ padding: "0.5rem" }}>Amount</th>
              <th style={{ padding: "0.5rem" }}>Grade</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Pool</th>
              <th style={{ padding: "0.5rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.8rem" }}>{d.id.slice(0, 12)}…</td>
                <td style={{ padding: "0.5rem" }}>{d.buyerName}</td>
                <td style={{ padding: "0.5rem" }}>
                  {d.amountFinanced != null
                    ? d.amountFinanced.toLocaleString("en-US", { style: "currency", currency: "USD" })
                    : "—"}
                </td>
                <td style={{ padding: "0.5rem" }}>{d.grade ?? "—"}</td>
                <td style={{ padding: "0.5rem" }}>{STATUS_LABEL[d.secondaryMarketStatus] ?? d.secondaryMarketStatus}</td>
                <td style={{ padding: "0.5rem" }}>{d.poolName ?? d.poolId ?? "—"}</td>
                <td style={{ padding: "0.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: "0.78rem" }} onClick={() => setAuditForId(d.id)}>
                      Audit trail
                    </button>
                    {!d.poolId && d.secondaryMarketStatus !== "SOLD" ? <AddToPoolForm dealId={d.id} pools={pools} /> : null}
                    {d.pendingAmendments.length > 0 ? (
                      <div style={{ border: "1px solid #7c2d12", borderRadius: 6, padding: "0.4rem", background: "#2b0f0a" }}>
                        <div style={{ fontSize: "0.72rem", color: "#fdba74", marginBottom: "0.3rem" }}>
                          Pending amendment ({d.pendingAmendments[0].reason.replace(/_/g, " ")})
                        </div>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          <AmendmentDecisionForm amendmentId={d.pendingAmendments[0].id} approve />
                          <AmendmentDecisionForm amendmentId={d.pendingAmendments[0].id} approve={false} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deals.length === 0 ? <p style={{ color: "var(--muted)", padding: "1rem" }}>No deals yet.</p> : null}
      </div>

      {auditDeal ? (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Assignment chain · {auditDeal.buyerName}</h2>
            <button type="button" className="btn btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setAuditForId(null)}>
              Close
            </button>
          </div>
          <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {auditDeal.events.length === 0 ? <li style={{ listStyle: "none", marginLeft: "-1rem" }}>No recorded transfers yet.</li> : null}
            {auditDeal.events.map((e) => (
              <li key={e.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{e.eventType.replace(/_/g, " ")}</strong> · {new Date(e.transactionDate).toLocaleString()}
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  From <span style={{ fontFamily: "monospace" }}>{e.fromEntityId.slice(0, 10)}</span> → To{" "}
                  <span style={{ fontFamily: "monospace" }}>{e.toEntityId.slice(0, 10)}</span>
                </div>
              </li>
            ))}
          </ol>
          <hr style={{ borderColor: "#333", margin: "1rem 0" }} />
          <h3 style={{ margin: 0, fontSize: "0.98rem" }}>UCC Article 3: Instrument Endorsements</h3>
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
            Pay to the order of: {auditDeal.instrument?.payToOrderOf ?? "—"} · eNote control:{" "}
            {auditDeal.instrument?.eNoteControlLocation ?? "—"}
          </p>
          <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {auditDeal.instrumentEvents.length === 0 ? (
              <li style={{ listStyle: "none", marginLeft: "-1rem" }}>No endorsement events recorded yet.</li>
            ) : null}
            {auditDeal.instrumentEvents.map((e) => (
              <li key={e.id} style={{ marginBottom: "0.5rem" }}>
                <strong>{e.transferType.replace(/_/g, " ")}</strong> · {new Date(e.transferDate).toLocaleString()}
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  Pay to the order of {e.toEntityId.slice(0, 10)} ·{" "}
                  {e.transferType === "SALE_WITHOUT_RECOURSE" || (e.endorsementLanguage ?? "").toUpperCase().includes("WITHOUT RECOURSE")
                    ? "Without Recourse"
                    : "With Recourse"}
                </div>
              </li>
            ))}
          </ol>
          <hr style={{ borderColor: "#333", margin: "1rem 0" }} />
          <h3 style={{ margin: 0, fontSize: "0.98rem" }}>Who worked this deal (dealer + lender)</h3>
          <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {auditDeal.activityEvents.length === 0 ? (
              <li style={{ listStyle: "none", marginLeft: "-1rem" }}>No activity events recorded yet.</li>
            ) : null}
            {auditDeal.activityEvents.map((e) => {
              const actorLabel = e.actorName ?? e.actorEmail ?? e.actorUserId.slice(0, 10);
              const side = e.actorRole.toUpperCase().includes("DEALER")
                ? "Dealer"
                : e.actorRole.toUpperCase().includes("LENDER")
                  ? "Lender"
                  : "System";
              return (
                <li key={e.id} style={{ marginBottom: "0.5rem" }}>
                  <strong>{e.eventType.replace(/_/g, " ")}</strong> · {new Date(e.timestamp).toLocaleString()}
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {side} · {actorLabel} · Role: {e.actorRole}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
