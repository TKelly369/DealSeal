"use client";

import { useEffect, useState, useCallback } from "react";
import { ActionButton } from "@/components/ActionButton";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/api-client";

type Summary = {
  transactionsByState: { state: string; count: number }[];
  sealedDeals: number;
  usageTotalUsd: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const s = await api<Summary>("/analytics/summary");
      setData(s);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ds-stack">
      <PageHeader
        kicker="Dashboard"
        title="Enterprise operations command center"
        subtitle="Monitor authoritative records, certified rendering custody, and verification endpoint demand across your institution."
      />

      {err && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: "1rem" }}>
          <p style={{ color: "#fecaca", margin: 0 }}>{err}</p>
        </div>
      )}

      {data && (
        <section className="ds-grid ds-grid--three">
          <StatCard
            title="Authoritative Governing Records"
            value={String(data.sealedDeals)}
            description="Deals in sealed-or-later custody state."
            tone="default"
          />
          <StatCard
            title="Certified Rendering Throughput"
            value={`$${data.usageTotalUsd}`}
            description="Institutional rendering usage (USD, all time)."
            tone="success"
          />
          <div className="card">
            <p className="ds-card-title">State distribution</p>
            <ul style={{ color: "var(--text-secondary)", fontSize: 13, paddingLeft: "1.1rem", margin: 0 }}>
              {data.transactionsByState.map((r) => (
                <li key={r.state}>
                  {r.state}: <strong style={{ color: "var(--text)" }}>{r.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="ds-grid ds-grid--three">
        <div className="card">
          <p className="ds-card-title">System Custody</p>
          <h3>Authoritative Governing Record control</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.85rem" }}>
            Maintain deterministic control of locked governing records and downstream certified rendering issuance.
          </p>
          <ActionButton href="/workspace">Open Deals Workspace</ActionButton>
        </div>
        <div className="card">
          <p className="ds-card-title">Verification Endpoint</p>
          <h3>Public verification workflows</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.85rem" }}>
            Expose status and chain-of-custody metadata without disclosing raw contract payloads.
          </p>
          <ActionButton href="/verify/test" variant="secondary">
            Open Verification Endpoint
          </ActionButton>
        </div>
        <div className="card">
          <p className="ds-card-title" style={{ color: "var(--warn-convenience)" }}>
            Non-Authoritative Copy
          </p>
          <h3>Operational copy handling</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.85rem" }}>
            Generate marked non-authoritative copies for review while preserving authoritative record primacy.
          </p>
          <ActionButton href="/documents" variant="secondary">
            Open Document Console
          </ActionButton>
        </div>
      </section>

      <section className="card">
        <p className="ds-card-title">Quick actions</p>
        <div className="row">
          <ActionButton href="/workspace">Create Deal</ActionButton>
          <ActionButton href="/verify/test" variant="secondary">
            Verify Record
          </ActionButton>
          <ActionButton href="/documents" variant="ghost">
            Download Certified Rendering
          </ActionButton>
        </div>
      </section>

      <section className="ds-grid ds-grid--two">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Audit Integrity</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 0.75rem" }}>
            Immutability-stamped events and enterprise trail review for regulatory and investor-grade reporting.
          </p>
          <ActionButton href="/audit" variant="secondary">
            View Audit Trail
          </ActionButton>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Document governance</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 0.75rem" }}>
            Centralized access to package composition, certified renderings, and transaction-linked document sets.
          </p>
          <ActionButton href="/packages" variant="secondary">
            Manage Documents
          </ActionButton>
        </div>
      </section>
    </div>
  );
}
