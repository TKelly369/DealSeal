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
  return `${dateLabel} · ${timeLabel} (24h)`;
}

export default function LiveDateTime24h() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const label = useMemo(() => formatDateTime(now), [now]);

  return <span style={{ color: "#9ca3af", fontSize: "0.78rem" }}>{label}</span>;
}

