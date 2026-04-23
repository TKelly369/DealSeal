"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutServerThenLocal } from "@/lib/auth-api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workspace", label: "Transaction workspace" },
  { href: "/documents", label: "Document panel" },
  { href: "/discrepancies", label: "Discrepancy view" },
  { href: "/approvals", label: "Approval flow" },
  { href: "/packages", label: "Package builder" },
  { href: "/audit", label: "Audit timeline" },
  { href: "/billing", label: "Billing dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/integrations", label: "Integrations & API" },
  { href: "/admin", label: "Admin console" },
];

const noShell = new Set(["/login", "/register"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const router = useRouter();
  const hide = noShell.has(path);

  if (hide) {
    return <main className="main-auth">{children}</main>;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <strong style={{ fontSize: 20, letterSpacing: "0.02em" }}>DealSeal™</strong>
        <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: 12 }}>
          Transaction Authority Platform
        </p>
        <nav>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p style={{ marginTop: "1.5rem", fontSize: 12 }}>
          <button
            type="button"
            onClick={async () => {
              await logoutServerThenLocal();
              router.replace("/login");
            }}
          >
            Log out
          </button>
        </p>
      </aside>
      <main>{children}</main>
    </div>
  );
}
