"use client";

import { usePathname, useRouter } from "next/navigation";
import { logoutServerThenLocal } from "@/lib/auth-api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export const PRIMARY_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/workspace", label: "Contracts" },
  { href: "/packages", label: "Packages" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/verification", label: "Verification" },
  { href: "/settings", label: "Settings" },
];

const AUTH_PATHS = new Set(["/login", "/register"]);

function getActiveNav(path: string): string {
  if (path.startsWith("/workspace")) return "/workspace";
  if (path.startsWith("/packages")) return "/packages";
  if (path.startsWith("/verification") || path.startsWith("/verify")) return "/verification";
  if (path.startsWith("/audit")) return "/audit";
  if (path.startsWith("/settings")) return "/settings";
  if (path.startsWith("/dashboard")) return "/";
  if (path === "/") return "/";
  return path;
}

function getHeaderCopy(path: string): { title: string; subtitle: string } {
  if (path.startsWith("/workspace") || path.startsWith("/deals")) {
    return {
      title: "Contracts",
      subtitle: "Authoritative contract control and execution operations.",
    };
  }
  if (path.startsWith("/packages")) {
    return {
      title: "Packages",
      subtitle: "Certified package assembly and delivery management.",
    };
  }
  if (path.startsWith("/verification") || path.startsWith("/verify")) {
    return {
      title: "Verification Endpoint",
      subtitle: "External verification access for lenders and servicing teams.",
    };
  }
  if (path.startsWith("/audit")) {
    return {
      title: "Audit Integrity",
      subtitle: "Immutable event history and compliance-oriented review.",
    };
  }
  if (path.startsWith("/settings")) {
    return {
      title: "Settings",
      subtitle: "System custody policy and enterprise governance controls.",
    };
  }
  return {
    title: "Dashboard",
    subtitle: "Authoritative Contract Infrastructure",
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();

  if (AUTH_PATHS.has(path)) {
    return <main className="main-auth">{children}</main>;
  }

  const header = getHeaderCopy(path);

  return (
    <div className="ds-shell">
      <AppSidebar />
      <div className="ds-main-wrap">
        <AppHeader
          title={header.title}
          subtitle={header.subtitle}
          onSignOut={async () => {
            await logoutServerThenLocal();
            router.replace("/login");
          }}
        />
        <main className="ds-main">{children}</main>
      </div>
    </div>
  );
}
