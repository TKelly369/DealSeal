"use client";

import type { UserRole } from "@/generated/prisma";
import { isAdminShellRole, isDealerStaffRole, isLenderStaffRole } from "@/lib/role-policy";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const COMMON_ROUTES = [
  { value: "/", label: "Home" },
  { value: "/ai-checkpoints", label: "AI Checkpoints" },
  { value: "/settings/api-keys", label: "Settings: API Keys & Webhooks" },
];

const USER_ROUTES = [{ value: "/dashboard", label: "Dashboard" }];

const DEALER_ROUTES = [
  { value: "/dealer/dashboard", label: "Dealer: Dashboard" },
  { value: "/dealer/deals", label: "Dealer: Deals" },
  { value: "/dealer/deals/new", label: "Dealer: New deal" },
  { value: "/dealer/files", label: "Dealer: Files" },
  { value: "/dealer/lenders", label: "Dealer: Lenders" },
  { value: "/dealer", label: "Dealer: Home" },
];

const LENDER_ROUTES = [
  { value: "/lender", label: "Lender: Home" },
  { value: "/lender/assets", label: "Lender: Assets & pools" },
];

const ADMIN_ROUTES = [
  { value: "/admin", label: "Admin Console" },
];

export function GlobalQuickNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();

  const inPreWorkspaceFlow =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signup" ||
    pathname === "/register" ||
    pathname === "/dealer/login" ||
    pathname === "/lender/login" ||
    pathname === "/admin/login" ||
    pathname === "/session-identity";
  if (inPreWorkspaceFlow) {
    return null;
  }

  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  const role = session.user.role as UserRole;
  const roleRoutes = (() => {
    if (isAdminShellRole(role)) return ADMIN_ROUTES;
    if (isLenderStaffRole(role)) return LENDER_ROUTES;
    if (isDealerStaffRole(role)) return DEALER_ROUTES;
    return USER_ROUTES;
  })();
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

