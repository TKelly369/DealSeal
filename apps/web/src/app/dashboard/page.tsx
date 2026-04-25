"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
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
    <div>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.35rem" }}>Operations dashboard</h1>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: 15, maxWidth: 62 * 8 }}>
          Sealed deal metrics, usage, and shortcuts to certified outputs, convenience copies, and audit review. Governing
          record actions run in Transaction workspace and connected APIs.
        </p>
      </header>

      {err && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: "1rem" }}>
          <p style={{ color: "#fecaca", margin: 0 }}>{err}</p>
        </div>
      )}

      {data && (
        <section className="row" style={{ marginBottom: "1.25rem" }}>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <h3 style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 0.5rem" }}>Sealed / late pipeline</h3>
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text)" }}>{data.sealedDeals}</p>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Org deals in sealed or later states</p>
          </div>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <h3 style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 0.5rem" }}>Usage (USD, all time)</h3>
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{data.usageTotalUsd}</p>
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>From usage events</p>
          </div>
          <div className="card" style={{ flex: "1 1 220px" }}>
            <h3 style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 0.5rem" }}>By state</h3>
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

      <section className="row" style={{ marginBottom: "1.25rem" }}>
        <div className="card" style={{ flex: "1 1 280px" }}>
          <p className="ds-card-title">Certified output</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.75rem" }}>
            Generate certified PDF and image renderings (single base contract, certification overlay) from a locked
            governing record in workspace flows.
          </p>
          <Link className="btn" href="/workspace">
            Open transaction workspace
          </Link>
        </div>
        <div className="card" style={{ flex: "1 1 280px", borderColor: "color-mix(in srgb, var(--warn-convenience) 35%, var(--border))" }}>
          <p className="ds-card-title" style={{ color: "var(--warn-convenience)" }}>
            Convenience copy
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.75rem" }}>
            Non-authoritative copies for reading and handoff. Clearly labeled; not a seal.
          </p>
          <Link className="btn btn-secondary" href="/workspace">
            Go to deals
          </Link>
        </div>
        <div className="card" style={{ flex: "1 1 280px" }}>
          <p className="ds-card-title">Verification</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 0.75rem" }}>
            Public status by governing record ID: hashes, version, and rendering history—no raw contract JSON.
          </p>
          <Link className="btn btn-secondary" href="/verify/test">
            Open test verify page
          </Link>
        </div>
      </section>

      <section className="row">
        <div className="card" style={{ flex: "1 1 300px" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 0.5rem" }}>Audit trail</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 0.75rem" }}>Immutability-stamped events and org-scoped review.</p>
          <Link className="btn btn-secondary" href="/audit">
            View audit timeline
          </Link>
        </div>
        <div className="card" style={{ flex: "1 1 300px" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 0.5rem" }}>Documents & packages</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 0.75rem" }}>Packages and document panels for operational follow-through.</p>
          <div className="row" style={{ gap: "0.5rem" }}>
            <Link className="btn btn-secondary" href="/documents">
              Documents
            </Link>
            <Link className="btn btn-secondary" href="/packages">
              Packages
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
