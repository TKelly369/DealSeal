"use client";

import { Session } from "next-auth";
import { use } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";

const NO_SHELL = new Set([
  "/",
  "/login",
  "/register",
  "/onboarding",
  "/about",
  "/contact",
  "/status",
  "/deal-builder",
  "/ai-checkpoints",
]);

function isLegalPath(p: string): boolean {
  return p.startsWith("/legal/");
}

function isVerifyPath(p: string): boolean {
  return p === "/verify" || p.startsWith("/verify/");
}

function isDemoRecordPath(p: string): boolean {
  return p === "/records" || p.startsWith("/records/");
}

/**
 * Marketing and auth pages: no sidebar. Authenticated app area: AppShell.
 */
export function ConditionalLayout({
  children,
  sessionPromise,
}: {
  children: React.ReactNode;
  sessionPromise: Promise<Session | null>;
}) {
  const path = usePathname() ?? "/";
  const session = use(sessionPromise);
  if (NO_SHELL.has(path) || isVerifyPath(path) || isDemoRecordPath(path) || isLegalPath(path)) {
    return <>{children}</>;
  }
  return <AppShell session={session}>{children}</AppShell>;
}
