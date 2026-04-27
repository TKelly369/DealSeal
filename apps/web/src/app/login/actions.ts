"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * After credentials sign-in, choose onboarding vs dashboard for dealer/lender admins.
 * Preserves explicit deep links (anything other than generic role home paths).
 */
export async function resolvePostLoginDestination(requestedNext: string | null): Promise<string> {
  const session = await auth();
  if (!session?.user) return "/login";

  const raw = requestedNext?.trim() || "";
  const next = raw.startsWith("/") ? raw : "";

  const { role, workspaceId } = session.user;

  if (role === "DEALER_ADMIN") {
    if (
      !next ||
      next === "/dashboard" ||
      next === "/dealer/dashboard" ||
      next === "/dealer/onboarding"
    ) {
      const completed = await prisma.dealerOnboardingAnswer.findFirst({
        where: { dealerId: workspaceId },
        select: { id: true },
      });
      return completed ? "/dealer/dashboard" : "/dealer/onboarding";
    }
    return next;
  }

  if (role === "LENDER_ADMIN") {
    if (
      !next ||
      next === "/dashboard" ||
      next === "/lender/dashboard" ||
      next === "/lender/onboarding"
    ) {
      const completed = await prisma.lenderOnboardingAnswer.findFirst({
        where: { lenderId: workspaceId },
        select: { id: true },
      });
      return completed ? "/lender/dashboard" : "/lender/onboarding";
    }
    return next;
  }

  return next || "/dashboard";
}
