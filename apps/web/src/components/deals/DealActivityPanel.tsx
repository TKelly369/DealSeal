"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import type { DealTimelineItem } from "@/lib/services/comment.service";
import { submitDealCommentAction, resolveDealCommentAction } from "@/lib/actions/deal-comment-actions";

type Props = {
  dealId: string;
  fromPath: "dealer" | "lender";
  timeline: DealTimelineItem[];
  currentUserId: string;
  /** Optional prefill for linked compliance/doc from parent */
  linkDraft: { linkedEntityType: string; linkedEntityId: string } | null;
  onClearLinkDraft: () => void;
  panelRef?: React.RefObject<HTMLDivElement | null>;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { hour12: false });
  } catch {
    return iso;
  }
}

export function DealActivityPanel({
  dealId,
  fromPath,
  timeline,
  currentUserId,
  linkDraft,
  onClearLinkDraft,
  panelRef,
}: Props) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const r = await submitDealCommentAction(
        fromPath,
        dealId,
        text,
        null,
        linkDraft?.linkedEntityType ?? null,
        linkDraft?.linkedEntityId ?? null,
      );
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setText("");
      onClearLinkDraft();
    });
  }, [dealId, fromPath, text, linkDraft, onClearLinkDraft]);

  const onResolve = (commentId: string) => {
    startTransition(async () => {
      await resolveDealCommentAction(fromPath, dealId, commentId);
    });
  };

  return (
    <div
      ref={panelRef}
      className="card"
      style={{
        position: "sticky",
        top: 16,
        maxHeight: "min(90vh, 720px)",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #333" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Activity &amp; comments</h2>
        <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.78rem" }}>
          System custody events and deal discussion in one place. Use <code>@userId:…</code> to mention a user.
        </p>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.65rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {timeline.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No activity yet.</p>
        ) : null}
        {timeline.map((item) => {
          if (item.kind === "custody") {
            return (
              <div
                key={item.id}
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  borderLeft: "2px solid #444",
                  paddingLeft: "0.5rem",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>[System]</span> {item.label}{" "}
                <span style={{ opacity: 0.85 }}>· {item.actorRole}</span> · {formatTime(item.at)}
              </div>
            );
          }
          const indent = item.parentCommentId ? { marginLeft: "0.75rem", borderLeft: "2px solid #3f3f46" } : {};
          return (
            <div
              key={item.id}
              style={{
                ...indent,
                padding: "0.5rem 0.45rem",
                borderRadius: 8,
                background: item.isException ? "rgba(234, 179, 8, 0.08)" : "rgba(39, 39, 42, 0.5)",
                border: `1px solid ${item.isException ? "#a16207" : "#3f3f46"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.author.name ?? item.author.email ?? "User"}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{formatTime(item.at)}</span>
              </div>
              {item.isException ? (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.35rem",
                    borderRadius: 4,
                    background: item.isResolved ? "#14532d" : "#7c2d12",
                    color: item.isResolved ? "#bbf7d0" : "#fecaca",
                  }}
                >
                  {item.isResolved ? "Resolved" : "Exception"}
                </span>
              ) : null}
              {item.parentCommentId ? <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>↳ Reply</div> : null}
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{item.body}</p>
              {item.isException && !item.isResolved ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "0.5rem", fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                  disabled={isPending}
                  onClick={() => onResolve(item.id)}
                >
                  Resolve
                </button>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {linkDraft ? (
        <div style={{ padding: "0.25rem 0.85rem", fontSize: "0.75rem", color: "#fbbf24", background: "rgba(113, 63, 18, 0.3)" }}>
          Linking to {linkDraft.linkedEntityType} <code style={{ fontSize: "0.7rem" }}>{linkDraft.linkedEntityId}</code>{" "}
          <button type="button" className="btn btn-secondary" style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem" }} onClick={onClearLinkDraft}>
            Clear
          </button>
        </div>
      ) : null}
      <div style={{ padding: "0.75rem 0.85rem", borderTop: "1px solid #333" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Add a comment… Use @userId:USER_CUID to notify."
          style={{
            width: "100%",
            padding: "0.45rem",
            borderRadius: 6,
            border: "1px solid #3f3f46",
            background: "#0c0c0e",
            color: "var(--text)",
            fontSize: "0.88rem",
            marginBottom: "0.5rem",
            resize: "vertical",
          }}
        />
        {error ? <p style={{ color: "#fecaca", fontSize: "0.82rem", margin: "0 0 0.35rem" }}>{error}</p> : null}
        <button type="button" className="btn" onClick={submit} disabled={isPending || !text.trim()}>
          {isPending ? "Sending…" : "Submit comment"}
        </button>
      </div>
    </div>
  );
}
