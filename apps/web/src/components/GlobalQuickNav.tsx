"use client";

import { usePathname, useRouter } from "next/navigation";

const ROUTES = [
  { value: "/", label: "Home" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/dealer/deals/new", label: "Dealer: New Deal Form" },
  { value: "/dealer/dashboard", label: "Dealer: Dashboard" },
  { value: "/lender/dashboard", label: "Lender: Dashboard" },
  { value: "/lender/assets", label: "Lender: Assets & Pools" },
  { value: "/ai-checkpoints", label: "AI Checkpoints" },
  { value: "/settings/api-keys", label: "Settings: API Keys & Webhooks" },
  { value: "/admin", label: "Admin Console" },
  { value: "/login", label: "Login" },
];

export function GlobalQuickNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const selected =
    ROUTES.find((r) => pathname === r.value || (r.value !== "/" && pathname.startsWith(r.value)))?.value ?? "";

  return (
    <div className="ds-global-quick-nav" role="navigation" aria-label="Quick page navigation">
      <label htmlFor="ds-quick-nav-select" className="ds-global-quick-nav__label">
        Quick Nav
      </label>
      <select
        id="ds-quick-nav-select"
        value={selected}
        onChange={(e) => {
          const next = e.target.value;
          if (next) router.push(next);
        }}
      >
        <option value="" disabled>
          Select page or form…
        </option>
        {ROUTES.map((route) => (
          <option key={route.value} value={route.value}>
            {route.label}
          </option>
        ))}
      </select>
    </div>
  );
}

