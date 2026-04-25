"use client";

import { usePathname, useRouter } from "next/navigation";
import { logoutServerThenLocal } from "@/lib/auth-api";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workspace", label: "Deals" },
  { href: "/governing-records", label: "Governing Records" },
  { href: "/certified-renderings", label: "Certified Renderings" },
  { href: "/verification", label: "Verification" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Settings" },
];

const AUTH_PATHS = new Set(["/login", "/register"]);

function getActiveNav(path: string): string {
  if (path.startsWith("/workspace")) return "/workspace";
  if (path.startsWith("/verification") || path.startsWith("/verify")) return "/verification";
  if (path.startsWith("/audit")) return "/audit";
  if (path.startsWith("/documents")) return "/documents";
  if (path.startsWith("/dashboard")) return "/dashboard";
  if (path.startsWith("/governing-records")) return "/governing-records";
  if (path.startsWith("/certified-renderings")) return "/certified-renderings";
  if (path.startsWith("/settings")) return "/settings";
  if (path.startsWith("/")) return "/dashboard";
  return path;
}

function getHeaderCopy(path: string): { title: string; subtitle: string } {
  if (path.startsWith("/workspace")) {
    return {
      title: "Deals Workspace",
      subtitle: "Manage authoritative contract execution and custody workflows.",
    };
  }
  if (path.startsWith("/governing-records")) {
    return {
      title: "Authoritative Governing Records",
      subtitle: "Canonical records and lifecycle custody controls.",
    };
  }
  if (path.startsWith("/certified-renderings")) {
    return {
      title: "Certified Renderings",
      subtitle: "Enterprise certification output and distribution governance.",
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
  if (path.startsWith("/documents")) {
    return {
      title: "Documents",
      subtitle: "Certified outputs and non-authoritative copy management.",
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
      <Sidebar
        nav={PRIMARY_NAV}
        activeHref={getActiveNav(path)}
        footerContent={
          <p style={{ marginTop: "1.25rem", fontSize: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await logoutServerThenLocal();
                router.replace("/login");
              }}
            >
              Log out
            </button>
          </p>
        }
      />
      <div className="ds-shell__content">
        <Header
          title={header.title}
          subtitle={header.subtitle}
          statusLabel="System Custody Active"
        />
        <main className="ds-main">{children}</main>
      </div>
    </div>
  );
}
