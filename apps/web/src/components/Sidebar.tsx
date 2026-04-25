"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

type NavItem = {
  href: string;
  label: string;
};

type SidebarProps = {
  nav: NavItem[];
  activeHref: string;
  footerContent?: React.ReactNode;
};

export function Sidebar({ nav, activeHref, footerContent }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="ds-sidebar__brand">
        <BrandLogo variant="nav" href="/" />
        <p className="ds-sidebar__tagline">
          Trusted contract authority for dealers, lenders, and servicing operations.
        </p>
        <span className="ds-sidebar__org">Enterprise custody</span>
      </div>
      <nav>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={activeHref === item.href ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: "auto" }}>{footerContent}</div>
    </aside>
  );
}
