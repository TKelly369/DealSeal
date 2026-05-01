"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

type CustodyReadModelResponse = {
  ok: boolean;
  recentEvents: Array<{
    eventId: string;
    eventType: string;
    timestamp: string;
    issuedBy: {
      userId: string | null;
      userName: string | null;
      role: string;
    };
    payload: Record<string, unknown>;
  }>;
};

export function DealCustodyTimeline({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CustodyReadModelResponse["recentEvents"]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<CustodyReadModelResponse>(`/api/custody/deals/${dealId}/read-model`, { method: "GET" })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.recentEvents);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load custody trail.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const items = useMemo(() => events.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [events]);

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Custody timeline</h2>
      {loading ? <p style={{ color: "var(--muted)", margin: 0 }}>Loading custody events…</p> : null}
      {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p style={{ color: "var(--muted)", margin: 0 }}>No custody events have been projected for this deal yet.</p>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ol style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "grid", gap: "0.75rem" }}>
          {items.map((event) => {
            const issuedBy = event.issuedBy.userName ?? event.issuedBy.userId ?? "system";
            const hashValue =
              event.eventType === "StipulationUploaded" &&
              typeof event.payload.content_sha256_hash === "string"
                ? event.payload.content_sha256_hash
                : null;
            return (
              <li key={event.eventId} style={{ borderLeft: "2px solid #2f855a", paddingLeft: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <strong>{event.eventType}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                    {new Date(event.timestamp).toLocaleString([], { hour12: false })}
                  </span>
                </div>
                <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  {issuedBy} · {event.issuedBy.role}
                </p>
                {hashValue ? (
                  <div style={{ marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <code style={{ fontSize: "0.78rem" }}>{`${hashValue.slice(0, 12)}...${hashValue.slice(-8)}`}</code>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                      onClick={() => navigator.clipboard.writeText(hashValue)}
                    >
                      Copy hash
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
