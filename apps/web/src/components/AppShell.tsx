"use client";

import { Session } from "next-auth";
import type { UserRole } from "@/generated/prisma";
import { demoWorkspaceIdForRole } from "@/lib/role-policy";
import { CommandMenu } from "@/components/shell/CommandMenu";
import { Header } from "@/components/shell/Header";
import { Sidebar } from "@/components/shell/Sidebar";
import { ShellUser } from "@/components/shell/types";
import { usePathname } from "next/navigation";

const noShell = new Set([
  "/login",
  "/register",
  "/signup",
  "/dealer/login",
  "/lender/login",
  "/admin/login",
]);

export function AppShell({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const path = usePathname() ?? "";
  const hide = noShell.has(path);
  const user: ShellUser = {
    name: session?.user?.name ?? "DealSeal User",
    email: session?.user?.email ?? "user@dealseal1.com",
    role: session?.user?.role ?? "DEALER_USER",
    workspaceId:
      session?.user?.workspaceId ??
      demoWorkspaceIdForRole((session?.user?.role ?? "DEALER_USER") as UserRole),
    workspaceName: "DealSeal Enterprise Workspace",
  };

  if (hide) {
    return <main className="main-auth">{children}</main>;
  }

  return (
    <div className="ds-shell-layout">
      <Sidebar user={user} />
      <div className="ds-shell-main">
        <Header user={user} />
        <main>{children}</main>
      </div>
      <CommandMenu />
    </div>
  );
}
