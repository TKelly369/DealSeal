"use server";

import type { UserRole } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { secureSessionCookies } from "@/lib/cookie-security";
import { prisma } from "@/lib/db";
import {
  getWorkspaceType,
  hasCompletedDealerOnboarding,
  hasCompletedLenderOnboarding,
} from "@/lib/onboarding-status";
import {
  isAdminShellRole,
  isDealerStaffRole,
  isLenderStaffRole,
  ROLE_HOME,
} from "@/lib/role-policy";
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
    next === ROLE_HOME.dealer ||
    next === "/dealer/dashboard" ||
    next === "/dealer/onboarding";
  const isGenericLenderEntry =
    !next ||
    next === "/dashboard" ||
    next === ROLE_HOME.lender ||
    next === "/lender/dashboard" ||
    next === "/lender/onboarding";

  if (isLenderStaffRole(role as UserRole) || workspaceId === "ws-lender-demo") {
    return isGenericLenderEntry ? ROLE_HOME.lender : next;
  }
  if (isDealerStaffRole(role as UserRole)) {
    return isGenericDealerEntry ? ROLE_HOME.dealer : next;
  }
  if (isAdminShellRole(role as UserRole)) {
    return next || ROLE_HOME.admin;
  }
  return next || "/dashboard";
}

async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
  try {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    return membership?.role === "OWNER";
  } catch {
    return false;
  }
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
      next === ROLE_HOME.dealer ||
      next === "/dealer/dashboard" ||
      next === "/dealer/onboarding";

    const isGenericLenderEntry =
      !next ||
      next === "/dashboard" ||
      next === ROLE_HOME.lender ||
      next === "/lender/dashboard" ||
      next === "/lender/onboarding";

    if (wsType === "DEALERSHIP" && isDealerStaffRole(role) && isGenericDealerEntry) {
      const completed = await hasCompletedDealerOnboarding(workspaceId);
      return completed ? ROLE_HOME.dealer : "/dealer/onboarding";
    }

    if (wsType === "LENDER" && isLenderStaffRole(role) && isGenericLenderEntry) {
      const completed = await hasCompletedLenderOnboarding(workspaceId);
      return completed ? ROLE_HOME.lender : "/lender/onboarding";
    }

    if (wsType === "INTERNAL" && isAdminShellRole(role)) {
      return next || ROLE_HOME.admin;
    }

    return next || "/dashboard";
  } catch (e) {
    console.error("[DealSeal] resolvePostLoginDestination: database unavailable, using role fallback", e);
    return roleFallbackDestination(role, workspaceId, next);
  }
}

type ResolvePostLoginInput = {
  requestedNext: string | null;
  userId: string;
  role: string;
  workspaceId: string;
};

/**
 * Role-aware destination resolver for combined login flow.
 * New/master accounts (workspace OWNER) go to onboarding when incomplete.
 * Employee accounts (ADMIN/MEMBER) skip onboarding and go to role dashboards.
 */
export async function resolvePostLoginDestinationForSession(input: ResolvePostLoginInput): Promise<string> {
  const raw = input.requestedNext?.trim() || "";
  let next = raw.startsWith("/") ? raw : "";

  try {
    const wsType = await getWorkspaceType(input.workspaceId);
    const owner = await isWorkspaceOwner(input.userId, input.workspaceId);

    // Landing "Dealers" vs "Lenders" tabs: if the signed-in workspace is the other platform, snap to the correct home
    // so users are not left on the wrong shell after login.
    if (wsType === "DEALERSHIP" && next.startsWith("/lender")) {
      next = ROLE_HOME.dealer;
    } else if (wsType === "LENDER" && next.startsWith("/dealer")) {
      next = ROLE_HOME.lender;
    }

    const isGenericDealerEntry =
      !next ||
      next === "/dashboard" ||
      next === ROLE_HOME.dealer ||
      next === "/dealer/dashboard" ||
      next === "/dealer/onboarding";

    const isGenericLenderEntry =
      !next ||
      next === "/dashboard" ||
      next === ROLE_HOME.lender ||
      next === "/lender/dashboard" ||
      next === "/lender/onboarding";

    if (wsType === "DEALERSHIP" && isDealerStaffRole(input.role as UserRole) && isGenericDealerEntry) {
      if (!owner) {
        return ROLE_HOME.dealer;
      }
      const completed = await hasCompletedDealerOnboarding(input.workspaceId);
      return completed ? ROLE_HOME.dealer : "/dealer/onboarding";
    }

    if (wsType === "LENDER" && isLenderStaffRole(input.role as UserRole) && isGenericLenderEntry) {
      if (!owner) {
        return ROLE_HOME.lender;
      }
      const completed = await hasCompletedLenderOnboarding(input.workspaceId);
      return completed ? ROLE_HOME.lender : "/lender/onboarding";
    }

    if (wsType === "INTERNAL" && isAdminShellRole(input.role as UserRole)) {
      return next || ROLE_HOME.admin;
    }

    return next || roleFallbackDestination(input.role, input.workspaceId, next);
  } catch (e) {
    console.error("[DealSeal] resolvePostLoginDestinationForSession: fallback", e);
    return roleFallbackDestination(input.role, input.workspaceId, next);
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
  try {
    const session = await auth();
    if (!session?.user) {
      // Session cookie may not be visible yet during immediate post-sign-in RPC calls.
      return { ok: true };
    }

    const fullName = input.fullName.trim();
    if (!fullName) {
      return { ok: true };
    }

    const loginPath = input.loginPath.startsWith("/") ? input.loginPath : "/dashboard";

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
