"use server";

import { auth } from "@/lib/auth";
import {
  getWorkspaceType,
  hasCompletedDealerOnboarding,
  hasCompletedLenderOnboarding,
} from "@/lib/onboarding-status";

/**
 * After credentials sign-in, choose onboarding vs dashboard for dealer/lender workspaces.
 * Preserves explicit deep links (anything other than generic role home paths).
 */
function roleFallbackDestination(
  role: string,
  workspaceId: string,
  next: string,
): string {
  const isGenericDealerEntry =
    !next ||
    next === "/dashboard" ||
    next === "/dealer/dashboard" ||
    next === "/dealer/onboarding";
  const isGenericLenderEntry =
    !next ||
    next === "/dashboard" ||
    next === "/lender/dashboard" ||
    next === "/lender/onboarding";

  if (role === "LENDER_ADMIN" || workspaceId === "ws-lender-demo") {
    return isGenericLenderEntry ? "/lender/dashboard" : next;
  }
  if (role === "DEALER_ADMIN" || role === "USER") {
    return isGenericDealerEntry ? "/dealer/dashboard" : next;
  }
  if (role === "ADMIN" || role === "PLATFORM_ADMIN") {
    return next || "/dashboard";
  }
  return next || "/dashboard";
}

export async function resolvePostLoginDestination(requestedNext: string | null): Promise<string> {
  const session = await auth();
  if (!session?.user) return "/login";

  const raw = requestedNext?.trim() || "";
  const next = raw.startsWith("/") ? raw : "";

  const { role, workspaceId } = session.user;

  try {
    const wsType = await getWorkspaceType(workspaceId);

    const isGenericDealerEntry =
      !next ||
      next === "/dashboard" ||
      next === "/dealer/dashboard" ||
      next === "/dealer/onboarding";

    const isGenericLenderEntry =
      !next ||
      next === "/dashboard" ||
      next === "/lender/dashboard" ||
      next === "/lender/onboarding";

    if (
      wsType === "DEALERSHIP" &&
      (role === "DEALER_ADMIN" || role === "USER") &&
      isGenericDealerEntry
    ) {
      const completed = await hasCompletedDealerOnboarding(workspaceId);
      return completed ? "/dealer/dashboard" : "/dealer/onboarding";
    }

    if (
      wsType === "LENDER" &&
      (role === "LENDER_ADMIN" || role === "USER") &&
      isGenericLenderEntry
    ) {
      const completed = await hasCompletedLenderOnboarding(workspaceId);
      return completed ? "/lender/dashboard" : "/lender/onboarding";
    }

    return next || "/dashboard";
  } catch (e) {
    console.error("[DealSeal] resolvePostLoginDestination: database unavailable, using role fallback", e);
    return roleFallbackDestination(role, workspaceId, next);
  }
}
