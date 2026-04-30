"use client";

import Link from "next/link";
import { useState } from "react";

type DealRow = {
  id: string;
  state: string;
  status: string;
  updatedAt: string;
  dealerName?: string;
  lenderName?: string;
};

export function GenerationHubClient({
  roleLabel,
  deals,
  basePath,
}: {
  roleLabel: "Dealer" | "Lender" | "Admin";
  deals: DealRow[];
  basePath: string;
}) {
  const [q, setQ] = useState("");
  const filtered = deals.filter((d) => d.id.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>{roleLabel} Generation Hub</h1>
      <p style={{ color: "var(--muted)", maxWidth: 900 }}>
        Central generation link for per-deal input, AI-driven population, document upload/analysis, and mismatch alerts.
        Changes made here flow through the deal jacket and related numbers/forms across finance, risk, compliance, and legal process controls.
      </p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <label>
          Find deal
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Deal ID" />
        </label>
      </div>
      <div className="card">
        <table className="ds-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Status</th>
              <th>State</th>
              <th>Updated</th>
              <th>Counterparty</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td><code>{d.id.slice(0, 10)}…</code></td>
                <td>{d.status}</td>
                <td>{d.state}</td>
                <td>{new Date(d.updatedAt).toLocaleString()}</td>
                <td>{d.dealerName ?? d.lenderName ?? "-"}</td>
                <td>
                  <Link className="btn btn-secondary" href={`${basePath}/${d.id}`}>
                    Open generation link
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
