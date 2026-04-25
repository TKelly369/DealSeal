"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { href: "/", label: "Dashboard", icon: "DB" },
  { href: "/workspace", label: "Contracts", icon: "CT" },
  { href: "/packages", label: "Packages", icon: "PK" },
  { href: "/verify/test", label: "Verification", icon: "VF" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/dashboard");
  if (href === "/workspace") return pathname.startsWith("/workspace") || pathname.startsWith("/records/");
  if (href === "/packages") return pathname.startsWith("/packages");
  if (href === "/verify/test") return pathname.startsWith("/verify") || pathname.startsWith("/verification");
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
            <span className="app-sidebar__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="app-sidebar__label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
