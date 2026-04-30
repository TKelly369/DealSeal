"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { adminShellNavItems } from "@/components/shell/admin-nav";
import { dealerShellNavItems } from "@/components/shell/dealer-nav";
import { lenderShellNavItems } from "@/components/shell/lender-nav";
import { shellNavItems } from "@/components/shell/nav";
import { ShellUser } from "@/components/shell/types";
import { isAdminShellRole, roleDisplayLabel } from "@/lib/role-policy";
import { useShellUiState } from "@/lib/ui-state";

function dealerNavActive(pathname: string, href: string): boolean {
  if (href === "/dealer") {
    return pathname === "/dealer" || pathname === "/dealer/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function lenderNavActive(pathname: string, href: string): boolean {
  if (href === "/lender") {
    return pathname === "/lender" || pathname === "/lender/dashboard";
  }
  if (href === "/lender/dealers") {
    return pathname === "/lender/dealers";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function adminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }
  if (href === "/admin/deals") {
    return pathname === "/admin/deals";
  }
  if (href === "/admin/audit") {
    return pathname === "/admin/audit";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavContent({ user, compact = false }: { user: ShellUser; compact?: boolean }) {
  const pathname = usePathname() ?? "";
  const useDealerShell =
    pathname.startsWith("/dealer") && !pathname.startsWith("/dealer/login");
  const useLenderShell =
    pathname.startsWith("/lender") && !pathname.startsWith("/lender/login");
  const useAdminShell = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  const items = useDealerShell
    ? dealerShellNavItems.map((item) => ({ ...item, adminOnly: false as const }))
    : useLenderShell
      ? lenderShellNavItems.map((item) => ({ ...item, adminOnly: false as const }))
      : useAdminShell
        ? adminShellNavItems.map((item) => ({ ...item, adminOnly: false as const }))
      : shellNavItems.filter((item) => !item.adminOnly || isAdminShellRole(user.role));

  return (
    <nav className="ds-shell-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const current = useDealerShell
          ? dealerNavActive(pathname, item.href)
          : useLenderShell
            ? lenderNavActive(pathname, item.href)
            : useAdminShell
              ? adminNavActive(pathname, item.href)
            : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className="ds-shell-nav-item"
            title={compact ? item.label : undefined}
          >
            <Icon size={16} />
            {!compact ? <span>{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ user }: { user: ShellUser }) {
  const { sidebarCollapsed, toggleSidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useShellUiState();

  return (
    <>
      <aside className={`ds-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="ds-sidebar-top">
          <Link href="/" className="ds-shell-logo">
            {sidebarCollapsed ? "DS" : "DealSeal"}
          </Link>
          <button type="button" onClick={toggleSidebarCollapsed} aria-label="Toggle sidebar">
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <p className="ds-shell-muted">{sidebarCollapsed ? roleDisplayLabel(user.role) : user.workspaceName}</p>
        <NavContent user={user} compact={sidebarCollapsed} />
      </aside>

      <Dialog.Root open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <Dialog.Trigger asChild>
          <button type="button" className="ds-mobile-nav-trigger" aria-label="Open navigation">
            <Menu size={18} />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="ds-sheet-overlay" />
          <Dialog.Content className="ds-sheet-content">
            <div className="ds-sidebar-top">
              <p className="ds-shell-logo">DealSeal</p>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close navigation">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <p className="ds-shell-muted">{user.workspaceName}</p>
            <NavContent user={user} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
