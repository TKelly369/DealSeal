"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const COMMON_ROUTES = [
  { value: "/", label: "Home" },
  { value: "/ai-checkpoints", label: "AI Checkpoints" },
  { value: "/settings/api-keys", label: "Settings: API Keys & Webhooks" },
];

const USER_ROUTES = [{ value: "/dashboard", label: "Dashboard" }];

const DEALER_ROUTES = [
  { value: "/dealer/deals/new", label: "Dealer: New Deal Form" },
  { value: "/dealer/dashboard", label: "Dealer: Dashboard" },
];

const LENDER_ROUTES = [
  { value: "/lender/dashboard", label: "Lender: Dashboard" },
  { value: "/lender/assets", label: "Lender: Assets & Pools" },
];

const ADMIN_ROUTES = [
  { value: "/admin", label: "Admin Console" },
];

export function GlobalQuickNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();

  const inPreWorkspaceFlow = pathname === "/login" || pathname.startsWith("/login/") || pathname === "/session-identity";
  if (inPreWorkspaceFlow) {
    return null;
  }

  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  const role = session.user.role;
  const roleRoutes =
    role === "LENDER_ADMIN"
      ? LENDER_ROUTES
      : role === "USER"
        ? USER_ROUTES
      : role === "ADMIN" || role === "PLATFORM_ADMIN"
        ? ADMIN_ROUTES
        : DEALER_ROUTES;
  const routes = [...COMMON_ROUTES, ...roleRoutes];

  const selected =
    routes.find((r) => pathname === r.value || (r.value !== "/" && pathname.startsWith(r.value)))?.value ?? "";

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
        {routes.map((route) => (
          <option key={route.value} value={route.value}>
            {route.label}
          </option>
        ))}
      </select>
    </div>
  );
}

