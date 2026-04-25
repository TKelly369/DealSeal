"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { href: "/", label: "Dashboard", icon: "DB" },
  { href: "/governing-records", label: "Governing Records", icon: "GR" },
  { href: "/certified-renderings", label: "Certified Renderings", icon: "CR" },
  { href: "/verification", label: "Verification", icon: "VF" },
  { href: "/audit-trail", label: "Audit Trail", icon: "AT" },
  { href: "/documents", label: "Documents", icon: "DC" },
  { href: "/settings", label: "Settings", icon: "ST" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/dashboard");
  if (href === "/governing-records") return pathname.startsWith("/governing-records");
  if (href === "/certified-renderings") return pathname.startsWith("/certified-renderings");
  if (href === "/audit-trail") return pathname.startsWith("/audit-trail") || pathname.startsWith("/audit");
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
