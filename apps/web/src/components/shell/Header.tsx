"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { UserNav } from "@/components/shell/UserNav";
import { ShellUser } from "@/components/shell/types";
import { useShellUiState } from "@/lib/ui-state";

function breadcrumbFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "Home";
  return parts.map((part) => part.replaceAll("-", " ")).join(" / ");
}

export function Header({ user }: { user: ShellUser }) {
  const pathname = usePathname() ?? "/";
  const breadcrumb = useMemo(() => breadcrumbFromPath(pathname), [pathname]);
  const setCommandMenuOpen = useShellUiState((s) => s.setCommandMenuOpen);
  const setMobileSidebarOpen = useShellUiState((s) => s.setMobileSidebarOpen);
  const [items, setItems] = useState<
    Array<{ id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        unreadCount: number;
        records: Array<{ id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }>;
      };
      if (!active) return;
      setUnreadCount(json.unreadCount ?? 0);
      setItems(json.records ?? []);
    }
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <header className="ds-shell-header">
      <button type="button" className="ds-shell-mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
        <span>☰</span>
      </button>
      <p className="ds-shell-breadcrumb">{breadcrumb}</p>
      <button type="button" className="btn btn-secondary ds-shell-search" onClick={() => setCommandMenuOpen(true)}>
        <Search size={14} /> Search <span className="ds-shell-key">Ctrl+K</span>
      </button>
      <details className="ds-user-nav">
        <summary>
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={16} />
            {unreadCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -8,
                  right: -10,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: "#ef4444",
                  color: "white",
                  fontSize: 10,
                  lineHeight: "16px",
                  textAlign: "center",
                  padding: "0 4px",
                  fontWeight: 700,
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </span>
          <span className="ds-user-name">Alerts</span>
        </summary>
        <div className="ds-user-menu" style={{ minWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0.45rem" }}>
            <strong style={{ fontSize: 12 }}>Notifications</strong>
            <button type="button" onClick={() => void markAllRead()} style={{ fontSize: 12 }}>
              Mark all as read
            </button>
          </div>
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {items.length === 0 ? (
              <p style={{ margin: "0.35rem 0.45rem", color: "var(--muted)", fontSize: 12 }}>No notifications yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} style={{ margin: "0.35rem 0.45rem", fontSize: 12, opacity: item.isRead ? 0.7 : 1 }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{item.message}</div>
                  <div style={{ color: "var(--muted)" }}>{new Date(item.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </details>
      <UserNav user={user} />
    </header>
  );
}
