"use server";

import { auth } from "@/lib/auth";
import { secureSessionCookies } from "@/lib/cookie-security";
import { prisma } from "@/lib/db";
import {
  getWorkspaceType,
  hasCompletedDealerOnboarding,
  hasCompletedLenderOnboarding,
} from "@/lib/onboarding-status";
import { cookies, headers } from "next/headers";

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

type BeginLoginAuditInput = {
  fullName: string;
  title?: string;
  phone?: string;
  loginPath: string;
};

/**
 * Begins immutable login audit metadata capture as part of sign-in.
 * This runs immediately after credentials auth succeeds.
 */
export async function beginLoginAuditTrail(input: BeginLoginAuditInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Session expired before identity confirmation." };
  }

  const fullName = input.fullName.trim();
  if (!fullName) {
    return { ok: false, error: "Full name is required." };
  }

  const loginPath = input.loginPath.startsWith("/") ? input.loginPath : "/dashboard";

  try {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: session.user.id }, { email: session.user.email?.toLowerCase() ?? "__none__" }],
      },
      select: { id: true },
    });

    if (dbUser) {
      const h = await headers();
      await prisma.userAccessAudit.create({
        data: {
          userId: dbUser.id,
          workspaceId: session.user.workspaceId,
          fullName,
          title: input.title?.trim() || null,
          phone: input.phone?.trim() || null,
          ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
          userAgent: h.get("user-agent") || null,
          metadata: {
            role: session.user.role,
            loginPath,
          },
        },
      });
    }
  } catch {
    // Keep sign-in resilient when DB/audit table is unavailable in early environments.
  }

  const cookieStore = await cookies();
  cookieStore.set("ds_identity_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureSessionCookies(),
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return { ok: true };
}
