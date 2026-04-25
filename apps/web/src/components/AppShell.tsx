"use client";

import { usePathname, useRouter } from "next/navigation";
import { logoutServerThenLocal } from "@/lib/auth-api";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export const PRIMARY_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/governing-records", label: "Governing Records" },
  { href: "/certified-renderings", label: "Certified Renderings" },
  { href: "/verification", label: "Verification" },
  { href: "/audit-trail", label: "Audit Trail" },
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Settings" },
];

const AUTH_PATHS = new Set(["/login", "/register"]);

function getActiveNav(path: string): string {
  if (path.startsWith("/governing-records")) return "/governing-records";
  if (path.startsWith("/certified-renderings")) return "/certified-renderings";
  if (path.startsWith("/verification") || path.startsWith("/verify")) return "/verification";
  if (path.startsWith("/audit-trail") || path.startsWith("/audit")) return "/audit-trail";
  if (path.startsWith("/documents")) return "/documents";
  if (path.startsWith("/settings")) return "/settings";
  if (path.startsWith("/dashboard")) return "/";
  if (path === "/") return "/";
  return path;
}

function getHeaderCopy(path: string): { title: string; subtitle: string } {
  if (path.startsWith("/governing-records")) {
    return {
      title: "Authoritative Governing Records",
      subtitle: "Canonical contract records in custody with versioned integrity controls.",
    };
  }
  if (path.startsWith("/certified-renderings")) {
    return {
      title: "Certified Visual Renderings",
      subtitle: "Verifiable visual outputs derived from one authoritative governing record.",
    };
  }
  if (path.startsWith("/verification") || path.startsWith("/verify")) {
    return {
      title: "Verification Endpoint",
      subtitle: "External verification access for lenders and servicing teams.",
    };
  }
  if (path.startsWith("/audit-trail") || path.startsWith("/audit")) {
    return {
      title: "Audit Integrity",
      subtitle: "Immutable event history and compliance-oriented review.",
    };
  }
  if (path.startsWith("/documents")) {
    return {
      title: "Documents",
      subtitle: "Manage rendered outputs, packages, and operational copy workflows.",
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
