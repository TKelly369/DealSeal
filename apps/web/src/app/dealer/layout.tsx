import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getWorkspaceType, hasCompletedDealerOnboarding } from "@/lib/onboarding-status";

export default async function DealerLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-dealseal-pathname") ?? "";
  if (
    !pathname ||
    pathname === "/dealer/onboarding" ||
    pathname.startsWith("/dealer/onboarding/")
  ) {
    return children;
  }

  const session = await auth();
  if (!session?.user) return children;

  if (session.user.role === "ADMIN" || session.user.role === "PLATFORM_ADMIN") {
    return children;
  }

  const wsType = await getWorkspaceType(session.user.workspaceId);
  if (wsType !== "DEALERSHIP") return children;

  if (session.user.role !== "DEALER_ADMIN" && session.user.role !== "USER") {
    return children;
  }

  if (await hasCompletedDealerOnboarding(session.user.workspaceId)) {
    return children;
  }

  redirect("/dealer/onboarding");
}
