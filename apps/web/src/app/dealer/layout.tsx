import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { isAdminShellRole, isDealerStaffRole } from "@/lib/role-policy";
import { getWorkspaceType, hasCompletedDealerOnboarding } from "@/lib/onboarding-status";

export default async function DealerLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-dealseal-pathname") ?? "";
  if (
    !pathname ||
    pathname === "/dealer" ||
    pathname === "/dealer/login" ||
    pathname === "/dealer/onboarding" ||
    pathname.startsWith("/dealer/onboarding/")
  ) {
    return children;
  }

  const session = await auth();
  if (!session?.user) return children;

  if (isAdminShellRole(session.user.role)) {
    return children;
  }

  const wsType = await getWorkspaceType(session.user.workspaceId);
  if (wsType !== "DEALERSHIP") return children;

  if (!isDealerStaffRole(session.user.role)) {
    return children;
  }

  if (await hasCompletedDealerOnboarding(session.user.workspaceId)) {
    return children;
  }

  redirect("/dealer/onboarding");
}
