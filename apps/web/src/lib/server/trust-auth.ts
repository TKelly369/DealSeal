import { auth } from "@/lib/auth";
import {
  isAdminShellRole,
  isAuditorRole,
  isComplianceAdminRole,
  isPlatformSuperRole,
  isSecurityAdminRole,
} from "@/lib/role-policy";

export async function requireTrustAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  if (isSecurityAdminRole(role) || isComplianceAdminRole(role) || isPlatformSuperRole(role) || role === "ADMIN_USER") {
    return session.user;
  }
  return null;
}

export async function requireTrustReader() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  if (isAdminShellRole(role) || isAuditorRole(role)) return session.user;
  return null;
}
