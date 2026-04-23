"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type IxCfg = { id: string; name: string; inboundSecret: string | null; provider: { key: string; category: string } };
type ApiK = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
};

export function IntegrationsClient() {
  const [ix, setIx] = useState<IxCfg[] | null>(null);
  const [keys, setKeys] = useState<ApiK[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("ui-created-key");
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [c, k] = await Promise.all([
        api<{ items: IxCfg[] }>("/integrations/configs"),
        api<{ items: ApiK[] }>("/admin/api-keys"),
      ]);
      setIx(c.items);
      setKeys(k.items);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  const createKey = useCallback(async () => {
    setErr(null);
    setCreated(null);
    try {
      const out = await api<{ id: string; keyPrefix: string; secret: string }>("/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      });
      setCreated(`Created — store once: ${out.secret.slice(0, 16)}…`);
      await load();
    } catch (e) {
      setErr(String(e));
    }
  }, [newName, load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {created && <p style={{ color: "var(--ok, #0a0)" }}>{created}</p>}
      <div className="row">
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Integration configs (tenant)</h3>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <ul style={{ fontSize: 13, color: "var(--muted)" }}>
            {(ix ?? []).map((r) => (
              <li key={r.id}>
                {r.name} — {r.provider?.category} / {r.provider?.key}
                {r.inboundSecret ? " · inbound secret set" : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="card" style={{ flex: "1 1 360px" }}>
          <h3>API keys (admin)</h3>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Use with <code>X-API-Key</code> on <code>GET {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/…</code>
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="key name"
            />
            <button type="button" onClick={() => void createKey()}>
              Create key
            </button>
          </div>
          <ul style={{ fontSize: 13, color: "var(--muted)" }}>
            {(keys ?? []).map((r) => (
              <li key={r.id}>
                {r.name} — {r.keyPrefix}…{r.active ? "" : " (revoked)"}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
