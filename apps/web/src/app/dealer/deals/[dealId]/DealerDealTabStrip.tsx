"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabDefs(dealId: string) {
  const base = `/dealer/deals/${dealId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/buyer`, label: "Buyer" },
    { href: `${base}/vehicle`, label: "Vehicle" },
    { href: `${base}/numbers`, label: "Numbers" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/compliance`, label: "Compliance" },
    { href: `${base}/submit`, label: "Submit" },
    { href: `${base}/review`, label: "Review" },
  ] as const;
}

export function DealerDealTabStrip({ dealId }: { dealId: string }) {
  const pathname = usePathname() ?? "";
  const tabs = tabDefs(dealId);

  return (
    <nav
      aria-label="Deal workspace"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.12))",
      }}
    >
      {tabs.map((t) => {
        const active =
          t.label === "Overview"
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="btn btn-secondary"
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.65rem",
              opacity: active ? 1 : 0.85,
              outline: active ? "1px solid var(--accent, #6ee7ff)" : undefined,
            }}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
