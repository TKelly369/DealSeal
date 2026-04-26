"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";

const NO_SHELL = new Set(["/", "/login", "/register"]);

function isVerifyPath(p: string): boolean {
  return p === "/verify" || p.startsWith("/verify/");
}

function isDemoRecordPath(p: string): boolean {
  return p === "/records" || p.startsWith("/records/");
}

/**
 * Marketing and auth pages: no sidebar. Authenticated app area: AppShell.
 */
export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  if (NO_SHELL.has(path) || isVerifyPath(path) || isDemoRecordPath(path)) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
