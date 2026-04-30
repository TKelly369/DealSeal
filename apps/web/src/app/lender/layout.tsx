import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { isAdminShellRole, isLenderStaffRole } from "@/lib/role-policy";
import { getWorkspaceType, hasCompletedLenderOnboarding } from "@/lib/onboarding-status";

export default async function LenderLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-dealseal-pathname") ?? "";
  if (
    !pathname ||
    pathname === "/lender" ||
    pathname === "/lender/login" ||
    pathname === "/lender/onboarding" ||
    pathname.startsWith("/lender/onboarding/")
  ) {
    return children;
  }

  const session = await auth();
  if (!session?.user) return children;

  if (isAdminShellRole(session.user.role)) {
    return children;
  }

  const wsType = await getWorkspaceType(session.user.workspaceId);
  if (wsType !== "LENDER") return children;

  if (!isLenderStaffRole(session.user.role)) {
    return children;
  }

  if (await hasCompletedLenderOnboarding(session.user.workspaceId)) {
    return children;
  }

  redirect("/lender/onboarding");
}
