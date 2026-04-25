"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/workspace", label: "Contracts" },
  { href: "/packages", label: "Packages" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/verification", label: "Verification" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/dashboard");
  if (href === "/workspace") return pathname.startsWith("/workspace");
  if (href === "/verification") return pathname.startsWith("/verification") || pathname.startsWith("/verify");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <BrandLogo variant="nav" href="/" />
      </div>
      <nav className="app-sidebar__nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
