import type { UserRole, WorkspaceType } from "@/generated/prisma";

/** Display label for shell / admin tables */
export function roleDisplayLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    DEALER_USER: "Dealer user",
    DEALER_MANAGER: "Dealer manager",
    LENDER_USER: "Lender user",
    LENDER_MANAGER: "Lender manager",
    ADMIN_USER: "Admin user",
    CUSTODIAN_ADMIN: "Custodian admin",
    SECURITY_ADMIN: "Security admin",
    COMPLIANCE_ADMIN: "Compliance admin",
    SUPPORT_REP: "Support representative",
    AUDITOR: "Auditor",
    SUPER_ADMIN: "Super admin",
  };
  return labels[role] ?? role;
}

export function isPlatformSuperRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/** Full admin console management (users, config, rules, documents, pools). */
export function isAdminManagementRole(role: UserRole): boolean {
  return (
    role === "ADMIN_USER" ||
    role === "SECURITY_ADMIN" ||
    role === "COMPLIANCE_ADMIN" ||
    role === "SUPER_ADMIN"
  );
}

/** Any staff who may open /admin or /audit. */
export function isAdminShellRole(role: UserRole): boolean {
  return (
    role === "ADMIN_USER" ||
    role === "CUSTODIAN_ADMIN" ||
    role === "SECURITY_ADMIN" ||
    role === "COMPLIANCE_ADMIN" ||
    role === "SUPPORT_REP" ||
    role === "AUDITOR" ||
    role === "SUPER_ADMIN"
  );
}

export function isSecurityAdminRole(role: UserRole): boolean {
  return role === "SECURITY_ADMIN" || role === "SUPER_ADMIN";
}

export function isComplianceAdminRole(role: UserRole): boolean {
  return role === "COMPLIANCE_ADMIN" || role === "SUPER_ADMIN";
}

export function isSupportRole(role: UserRole): boolean {
  return role === "SUPPORT_REP";
}

export function isAuditorRole(role: UserRole): boolean {
  return role === "AUDITOR";
}

export function isDealerStaffRole(role: UserRole): boolean {
  return role === "DEALER_USER" || role === "DEALER_MANAGER";
}

export function isDealerManagerRole(role: UserRole): boolean {
  return role === "DEALER_MANAGER";
}

export function isLenderStaffRole(role: UserRole): boolean {
  return role === "LENDER_USER" || role === "LENDER_MANAGER";
}

export function isLenderManagerRole(role: UserRole): boolean {
  return role === "LENDER_MANAGER";
}

/** Which `Workspace.type` a user role must belong to (organization = workspace). */
export function workspaceTypeForUserRole(role: UserRole): WorkspaceType {
  if (isDealerStaffRole(role)) return "DEALERSHIP";
  if (isLenderStaffRole(role)) return "LENDER";
  if (isAdminShellRole(role)) return "INTERNAL";
  return "DEALERSHIP";
}

export function roleMatchesWorkspaceType(role: UserRole, workspaceType: WorkspaceType): boolean {
  return workspaceTypeForUserRole(role) === workspaceType;
}

/** Demo workspace ids (see `scripts/seed-web-billing.ts`, mock logins in `auth.ts`). */
export const DEMO_WORKSPACE_IDS = {
  dealer: "workspace-main",
  lender: "ws-lender-demo",
  internal: "ws-dealseal-internal",
} as const;

export function demoWorkspaceIdForRole(role: UserRole): string {
  const t = workspaceTypeForUserRole(role);
  if (t === "LENDER") return DEMO_WORKSPACE_IDS.lender;
  if (t === "INTERNAL") return DEMO_WORKSPACE_IDS.internal;
  return DEMO_WORKSPACE_IDS.dealer;
}

/** Paths custodian admins must not access (middleware + pages). */
export const CUSTODIAN_ADMIN_BLOCKED_PREFIXES = [
  "/admin/users",
  "/admin/system-config",
  "/admin/links",
  "/admin/rules",
  "/admin/documents",
  "/admin/pools",
] as const;

/** @deprecated Use CUSTODIAN_ADMIN_BLOCKED_PREFIXES */
export const ADMIN_SYSTEM_REP_BLOCKED_PREFIXES = CUSTODIAN_ADMIN_BLOCKED_PREFIXES;

export function isCustodianAdminBlockedPath(pathname: string): boolean {
  return CUSTODIAN_ADMIN_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** @deprecated Use isCustodianAdminBlockedPath */
export function isAdminSystemRepBlockedPath(pathname: string): boolean {
  return isCustodianAdminBlockedPath(pathname);
}

/** Canonical role roots (middleware + post-login routing). */
export const ROLE_HOME = {
  dealer: "/dealer",
  lender: "/lender",
  admin: "/admin",
} as const;

/** Default landing route after login when no explicit `next` path is set (middleware + login helpers). */
export function defaultHomeForRole(role: string): string {
  switch (role) {
    case "LENDER_USER":
    case "LENDER_MANAGER":
      return ROLE_HOME.lender;
    case "DEALER_USER":
    case "DEALER_MANAGER":
      return ROLE_HOME.dealer;
    case "ADMIN_USER":
    case "CUSTODIAN_ADMIN":
    case "SECURITY_ADMIN":
    case "COMPLIANCE_ADMIN":
    case "SUPPORT_REP":
    case "AUDITOR":
    case "SUPER_ADMIN":
      return ROLE_HOME.admin;
    default:
      return "/dashboard";
  }
}

/** When an authenticated user hits /admin without permission, send them to the best-fit workspace home. */
export function redirectHomeForUnauthorizedAdmin(role: string): string {
  switch (role) {
    case "LENDER_USER":
    case "LENDER_MANAGER":
      return ROLE_HOME.lender;
    case "DEALER_USER":
    case "DEALER_MANAGER":
      return ROLE_HOME.dealer;
    default:
      return "/dashboard";
  }
}
