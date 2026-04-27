"use client";

import { useEffect, useMemo, useState } from "react";

function formatDateTime(d: Date) {
  const dateLabel = d.toLocaleDateString();
  const timeLabel = d.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${dateLabel} · ${timeLabel}`;
}

export default function LiveDateTime24h() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const label = useMemo(() => formatDateTime(now), [now]);

  return (
    <span
      style={{
        color: "#e5e7eb",
        fontSize: "0.86rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "0.28rem 0.65rem",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}
    </span>
  );
}

