"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";

const NO_SHELL = new Set(["/", "/login", "/register"]);

function isVerifyPath(p: string): boolean {
  return p === "/verify" || p.startsWith("/verify/");
}

/**
 * Marketing and auth pages: no sidebar. Authenticated app area: AppShell.
 */
export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const isRecordPath = path.startsWith("/records/");
  if (NO_SHELL.has(path) || isVerifyPath(path) || isRecordPath) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
