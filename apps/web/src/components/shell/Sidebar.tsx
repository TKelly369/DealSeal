"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { shellNavItems } from "@/components/shell/nav";
import { ShellUser } from "@/components/shell/types";
import { useShellUiState } from "@/lib/ui-state";

function NavContent({ user, compact = false }: { user: ShellUser; compact?: boolean }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="ds-shell-nav">
      {shellNavItems
        .filter((item) => !item.adminOnly || user.role === "ADMIN" || user.role === "PLATFORM_ADMIN")
        .map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
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
        <p className="ds-shell-muted">{sidebarCollapsed ? user.role.toUpperCase() : user.workspaceName}</p>
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
