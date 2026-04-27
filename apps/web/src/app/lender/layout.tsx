import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getWorkspaceType, hasCompletedLenderOnboarding } from "@/lib/onboarding-status";

export default async function LenderLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-dealseal-pathname") ?? "";
  if (
    !pathname ||
    pathname === "/lender/onboarding" ||
    pathname.startsWith("/lender/onboarding/")
  ) {
    return children;
  }

  const session = await auth();
  if (!session?.user) return children;

  if (session.user.role === "ADMIN" || session.user.role === "PLATFORM_ADMIN") {
    return children;
  }

  const wsType = await getWorkspaceType(session.user.workspaceId);
  if (wsType !== "LENDER") return children;

  if (session.user.role !== "LENDER_ADMIN" && session.user.role !== "USER") {
    return children;
  }

  if (await hasCompletedLenderOnboarding(session.user.workspaceId)) {
    return children;
  }

  redirect("/lender/onboarding");
}
