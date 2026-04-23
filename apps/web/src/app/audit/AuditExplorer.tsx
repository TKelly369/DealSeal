"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";

type NormalizedEntry = {
  id: string;
  createdAt: string;
  channel: string;
  title: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload: unknown;
};

export function AuditExplorer() {
  const [transactionId, setTransactionId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [packageJobId, setPackageJobId] = useState("");
  const [eventTypes, setEventTypes] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timeline, setTimeline] = useState<NormalizedEntry[] | null>(null);
  const [txDetail, setTxDetail] = useState<unknown>(null);
  const [docDetail, setDocDetail] = useState<unknown>(null);
  const [pkgDetail, setPkgDetail] = useState<unknown>(null);
  const [searchItems, setSearchItems] = useState<unknown[] | null>(null);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!transactionId.trim()) {
      setErr("Transaction id required");
      return;
    }
    setErr(null);
    const q = new URLSearchParams({
      normalized: "true",
      limit: "50",
    });
    const data = await api<{ entries: NormalizedEntry[]; nextCursor: string | null }>(
      `/audit/transactions/${transactionId.trim()}/timeline?${q}`,
    );
    setTimeline(data.entries);
  }, [transactionId]);

  const loadTxDetail = useCallback(async () => {
    if (!transactionId.trim()) {
      setErr("Transaction id required");
      return;
    }
    setErr(null);
    const d = await api(`/audit/transactions/${transactionId.trim()}`);
    setTxDetail(d);
  }, [transactionId]);

  const loadDocDetail = useCallback(async () => {
    if (!documentId.trim()) {
      setErr("Document id required");
      return;
    }
    setErr(null);
    const d = await api(`/audit/documents/${documentId.trim()}`);
    setDocDetail(d);
  }, [documentId]);

  const loadPkgDetail = useCallback(async () => {
    if (!packageJobId.trim()) {
      setErr("Package job id required");
      return;
    }
    setErr(null);
    const d = await api(`/audit/packages/${packageJobId.trim()}`);
    setPkgDetail(d);
  }, [packageJobId]);

  const runSearch = useCallback(
    async (cursor?: string | null) => {
      setErr(null);
      const q = new URLSearchParams({ limit: "30" });
      if (transactionId.trim()) q.set("transactionId", transactionId.trim());
      if (eventTypes.trim()) q.set("eventTypes", eventTypes.trim());
      if (actorUserId.trim()) q.set("actorUserId", actorUserId.trim());
      if (entityType.trim()) q.set("entityType", entityType.trim());
      if (from.trim()) q.set("from", new Date(from).toISOString());
      if (to.trim()) q.set("to", new Date(to).toISOString());
      if (cursor) q.set("cursor", cursor);
      const data = await api<{ items: unknown[]; nextCursor: string | null }>(
        `/audit/search?${q}`,
      );
      setSearchItems((prev) => (cursor ? [...(prev ?? []), ...data.items] : data.items));
      setSearchCursor(data.nextCursor);
    },
    [transactionId, eventTypes, actorUserId, entityType, from, to],
  );

  const wrap = async (fn: () => Promise<void>) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p style={{ color: "var(--muted)" }}>
        Read-only API: <code>GET /audit/transactions/:id</code>,{" "}
        <code>.../timeline?normalized=true</code>, <code>/audit/documents/:id</code>,{" "}
        <code>/audit/packages/:id</code>, <code>/audit/search</code>. Use an Auditor JWT (
        <code>dealseal_token</code>).
      </p>
      {err ? <p style={{ color: "#f87171" }}>{err}</p> : null}

      <label>
        Transaction id (UUID)
        <input
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          placeholder="from seed output"
          style={{
            width: "100%",
            marginTop: "0.25rem",
            padding: "0.35rem 0.5rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
          }}
        />
      </label>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={() => void wrap(loadTimeline)}>
          Load normalized timeline
        </button>
        <button type="button" onClick={() => void wrap(loadTxDetail)}>
          Transaction audit detail
        </button>
      </div>

      {timeline ? (
        <div>
          <h3>Timeline ({timeline.length})</h3>
          <ul style={{ listStyle: "none", padding: 0, maxHeight: "320px", overflow: "auto" }}>
            {timeline.map((e) => (
              <li
                key={e.id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem 0",
                  fontSize: "0.9rem",
                }}
              >
                <strong>{e.title}</strong>
                <div style={{ color: "var(--muted)" }}>
                  {e.createdAt} · {e.channel}
                  {e.entityType ? ` · ${e.entityType}` : ""}
                  {e.entityId ? ` · ${e.entityId}` : ""}
                  {e.actorUserId ? ` · actor ${e.actorUserId}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {txDetail ? (
        <details>
          <summary>Raw transaction audit detail</summary>
          <pre style={{ overflow: "auto", maxHeight: "240px", fontSize: "0.75rem" }}>
            {JSON.stringify(txDetail, null, 2)}
          </pre>
        </details>
      ) : null}

      <hr style={{ borderColor: "var(--border)" }} />

      <h3>Cross-transaction search</h3>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <label>
          eventTypes (comma)
          <input
            value={eventTypes}
            onChange={(e) => setEventTypes(e.target.value)}
            placeholder="DOCUMENT_UPLOAD_FINALIZE,PACKAGE_JOB_SUCCEEDED"
            style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 360 }}
          />
        </label>
        <label>
          actorUserId
          <input
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 280 }}
          />
        </label>
        <label>
          entityType
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 200 }}
          />
        </label>
        <label>
          from
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ display: "block", marginTop: 4 }}
          />
        </label>
        <label>
          to
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ display: "block", marginTop: 4 }}
          />
        </label>
      </div>
      <button type="button" onClick={() => void wrap(() => runSearch(null))}>
        Search audit events
      </button>
      {searchCursor ? (
        <button type="button" onClick={() => void wrap(() => runSearch(searchCursor))}>
          Next page
        </button>
      ) : null}
      {searchItems ? (
        <pre style={{ overflow: "auto", maxHeight: "280px", fontSize: "0.75rem" }}>
          {JSON.stringify(searchItems, null, 2)}
        </pre>
      ) : null}

      <hr style={{ borderColor: "var(--border)" }} />

      <label>
        Document id
        <input
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          style={{ width: "100%", marginTop: "0.25rem", padding: "0.35rem 0.5rem" }}
        />
      </label>
      <button type="button" onClick={() => void wrap(loadDocDetail)}>
        Document audit detail
      </button>
      {docDetail ? (
        <pre style={{ overflow: "auto", maxHeight: "240px", fontSize: "0.75rem" }}>
          {JSON.stringify(docDetail, null, 2)}
        </pre>
      ) : null}

      <label>
        Package job id
        <input
          value={packageJobId}
          onChange={(e) => setPackageJobId(e.target.value)}
          style={{ width: "100%", marginTop: "0.25rem", padding: "0.35rem 0.5rem" }}
        />
      </label>
      <button type="button" onClick={() => void wrap(loadPkgDetail)}>
        Package job audit detail
      </button>
      {pkgDetail ? (
        <pre style={{ overflow: "auto", maxHeight: "240px", fontSize: "0.75rem" }}>
          {JSON.stringify(pkgDetail, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
