"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useShellUiState } from "@/lib/ui-state";

const NAVIGATION = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Workflows", href: "/workspace" },
  { label: "Documents", href: "/documents" },
  { label: "Settings", href: "/settings" },
  { label: "Admin", href: "/admin" },
];

export function CommandMenu() {
  const router = useRouter();
  const { commandMenuOpen, setCommandMenuOpen } = useShellUiState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandMenuOpen(!commandMenuOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandMenuOpen, setCommandMenuOpen]);

  if (!commandMenuOpen) return null;

  return (
    <div className="ds-command-overlay" onClick={() => setCommandMenuOpen(false)}>
      <Command className="ds-command" onClick={(e) => e.stopPropagation()}>
        <Command.Input placeholder="Search navigation or actions..." className="ds-command-input" />
        <Command.List>
          <Command.Group heading="Navigation">
            {NAVIGATION.map((item) => (
              <Command.Item
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  setCommandMenuOpen(false);
                }}
              >
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item
              onSelect={() => {
                router.push("/workspace");
                setCommandMenuOpen(false);
              }}
            >
              Create Workflow
            </Command.Item>
            <Command.Item
              onSelect={() => {
                router.push("/documents");
                setCommandMenuOpen(false);
              }}
            >
              Upload Document
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Account">
            <Command.Item
              onSelect={() => {
                router.push("/settings");
                setCommandMenuOpen(false);
              }}
            >
              Settings
            </Command.Item>
            <Command.Item
              onSelect={() => {
                router.push("/login");
                setCommandMenuOpen(false);
              }}
            >
              Logout
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
