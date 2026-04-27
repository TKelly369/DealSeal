"use client";

type HdcStatus = "UNEVALUATED" | "QUALIFIED" | "REVIEW_REQUIRED" | "DEFECTIVE";

const STYLE_BY_STATUS: Record<HdcStatus, { label: string; bg: string; fg: string; dot: string }> = {
  QUALIFIED: { label: "HDC Ready", bg: "#14532d", fg: "#bbf7d0", dot: "#22c55e" },
  DEFECTIVE: { label: "HDC Defective", bg: "#7f1d1d", fg: "#fecaca", dot: "#ef4444" },
  REVIEW_REQUIRED: { label: "Review Required", bg: "#78350f", fg: "#fde68a", dot: "#f59e0b" },
  UNEVALUATED: { label: "Review Required", bg: "#78350f", fg: "#fde68a", dot: "#f59e0b" },
};

export function HDCStatusBadge({ status, defects }: { status: HdcStatus | null | undefined; defects: string[] }) {
  const normalized = status ?? "UNEVALUATED";
  const style = STYLE_BY_STATUS[normalized];
  const hasDefects = defects.length > 0;

  return (
    <details style={{ display: "inline-block", position: "relative" }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          borderRadius: 999,
          padding: "0.2rem 0.55rem",
          fontSize: "0.75rem",
          fontWeight: 700,
          background: style.bg,
          color: style.fg,
          border: "1px solid #333",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: style.dot,
            display: "inline-block",
          }}
        />
        {style.label}
      </summary>
      <div
        style={{
          position: "absolute",
          right: 0,
          marginTop: "0.4rem",
          width: 290,
          background: "#0f1115",
          border: "1px solid #30343a",
          borderRadius: 8,
          padding: "0.55rem",
          zIndex: 30,
          boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
        }}
      >
        <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.8rem" }}>HDC Qualification</p>
        {normalized === "QUALIFIED" ? (
          <p style={{ margin: 0, color: "#bbf7d0", fontSize: "0.8rem" }}>
            Instrument is qualified for Holder in Due Course status; sale-ready without recourse.
          </p>
        ) : hasDefects ? (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#fca5a5", fontSize: "0.78rem" }}>
            {defects.map((d, i) => (
              <li key={`${i}-${d}`}>{d}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "#fde68a", fontSize: "0.8rem" }}>
            Review required. Instrument has not been fully validated yet.
          </p>
        )}
      </div>
    </details>
  );
}

