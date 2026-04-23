"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Dashboard = {
  lastSnapshot: unknown;
  currentPeriod: { periodStart: string; periodEnd: string; metrics: Record<string, unknown> };
};

export function AnalyticsClient() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [reports, setReports] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api<Dashboard>("/analytics/dashboard");
      setDash(d);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  const loadReports = useCallback(async () => {
    setErr(null);
    try {
      const r = await api<unknown>("/analytics/reports");
      setReports(r);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  const doExport = useCallback(async () => {
    setExporting(true);
    setErr(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const token = (await import("@/lib/session")).getToken();
      const res = await fetch(`${base}/analytics/export?format=json`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? res.statusText);
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "analytics-export.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(String(e));
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="row">
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Current period (dashboard)</h3>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <pre style={{ fontSize: 12, maxHeight: 360, overflow: "auto" }}>
            {dash ? JSON.stringify(dash, null, 2) : "—"}
          </pre>
        </div>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Advanced reports (PRO+)</h3>
          <button type="button" onClick={() => void loadReports()}>
            Load reports
          </button>
          <button type="button" disabled={exporting} onClick={() => void doExport()}>
            {exporting ? "Exporting…" : "Download JSON export"}
          </button>
          <pre style={{ fontSize: 12, maxHeight: 360, overflow: "auto" }}>
            {reports ? JSON.stringify(reports, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}
