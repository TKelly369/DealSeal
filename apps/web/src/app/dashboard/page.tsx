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
      <h1>Dashboard</h1>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {data && (
        <div className="row" style={{ marginTop: "1rem" }}>
          <div className="card" style={{ flex: "1 1 240px" }}>
            <h3>Sealed / active pipeline</h3>
            <p style={{ fontSize: 28, fontWeight: 600 }}>{data.sealedDeals}</p>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Deals in sealed or later states (org)</p>
          </div>
          <div className="card" style={{ flex: "1 1 240px" }}>
            <h3>Usage (USD, all time)</h3>
            <p style={{ fontSize: 28, fontWeight: 600 }}>{data.usageTotalUsd}</p>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>From usage events</p>
          </div>
          <div className="card" style={{ flex: "1 1 240px" }}>
            <h3>By state</h3>
            <ul style={{ color: "var(--muted)", fontSize: 13, paddingLeft: "1.2rem" }}>
              {data.transactionsByState.map((r) => (
                <li key={r.state}>
                  {r.state}: {r.count}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="badge" style={{ marginTop: "1.5rem" }}>
        <Link href="/workspace">Open transaction workspace</Link> ·{" "}
        <Link href="/billing">Billing</Link> · <Link href="/audit">Audit</Link>
      </p>
    </div>
  );
}
