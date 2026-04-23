"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Lender = { id: string; code: string; name: string; active: boolean };
type LProg = { id: string; key: string; name: string; active: boolean; lender: { code: string } };
type Ue = { id: string; eventType: string; amountUsd: string; recordedAt: string };

export function AdminClient() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [progs, setProgs] = useState<LProg[]>([]);
  const [usage, setUsage] = useState<Ue[]>([]);
  const [tlog, setTlog] = useState<string | null>(null);
  const [authEx, setAuthEx] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txId, setTxId] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [a, b, c] = await Promise.all([
        api<{ items: Lender[] }>("/admin/lenders"),
        api<{ items: LProg[] }>("/admin/lender-programs"),
        api<{ items: Ue[] }>("/admin/usage-events?limit=40"),
      ]);
      setLenders(a.items);
      setProgs(b.items);
      setUsage(c.items);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  const loadLog = useCallback(async () => {
    if (!txId.trim()) return;
    setErr(null);
    try {
      const r = await api<{ items: unknown[] }>(
        `/admin/state-transitions?transactionId=${encodeURIComponent(txId.trim())}`,
      );
      setTlog(JSON.stringify(r.items, null, 2));
    } catch (e) {
      setErr(String(e));
    }
  }, [txId]);

  const loadAuthority = useCallback(async () => {
    if (!txId.trim()) return;
    setErr(null);
    try {
      const [ex, pfi] = await Promise.all([
        api<{ items: unknown[] }>(
          `/admin/authority/execution?transactionId=${encodeURIComponent(txId.trim())}`,
        ),
        api<{ items: unknown[] }>(
          `/admin/authority/post-funding?transactionId=${encodeURIComponent(txId.trim())}`,
        ),
      ]);
      setAuthEx({ execution: ex, postFunding: pfi });
    } catch (e) {
      setErr(String(e));
    }
  }, [txId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <button type="button" onClick={() => void load()}>
        Refresh
      </button>
      <div className="card">
        <h3>Lenders — GET /admin/lenders</h3>
        <ul style={{ fontSize: 13, color: "var(--muted)" }}>
          {lenders.map((l) => (
            <li key={l.id}>
              {l.code} — {l.name} ({l.active ? "on" : "off"})
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Programs — GET /admin/lender-programs</h3>
        <ul style={{ fontSize: 13, color: "var(--muted)" }}>
          {progs.map((p) => (
            <li key={p.id}>
              {p.lender?.code} / {p.key} — {p.name} ({p.active ? "on" : "off"})
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Usage (admin) — GET /admin/usage-events</h3>
        <ul style={{ fontSize: 12, maxHeight: 200, overflow: "auto" }}>
          {usage.map((u) => (
            <li key={u.id} style={{ color: "var(--muted)" }}>
              {u.eventType} {u.amountUsd}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>State transition log</h3>
        <input
          value={txId}
          onChange={(e) => setTxId(e.target.value)}
          placeholder="transaction uuid"
          style={{ width: "100%", maxWidth: 400, display: "block", marginBottom: 8 }}
        />
        <button type="button" onClick={() => void loadLog()}>
          Load GET /admin/state-transitions
        </button>
        {tlog && (
          <pre style={{ fontSize: 11, maxHeight: 240, overflow: "auto", marginTop: 8 }}>
            {tlog}
          </pre>
        )}
        <button type="button" onClick={() => void loadAuthority()} style={{ marginTop: 8 }}>
          Load authority (execution + post-funding)
        </button>
        {authEx ? (
          <pre style={{ fontSize: 10, maxHeight: 200, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(authEx, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
