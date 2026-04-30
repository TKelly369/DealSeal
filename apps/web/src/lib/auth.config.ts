/**
 * Edge Runtime only. Do not import: Prisma, `fs`, Node `crypto`, or `@/lib/auth` (Node auth module).
 * Use `createAuthConfig()` in `middleware.ts`; the Credentials provider and Prisma live in `auth.ts` + `runtime = "nodejs"`.
 */
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/generated/prisma";
import { demoWorkspaceIdForRole } from "@/lib/role-policy";
import { secureSessionCookies } from "@/lib/cookie-security";

const DEV_AUTH_SECRET_FALLBACK =
  "dealseal-dev-only-unsafe-secret-set-AUTH_SECRET-for-production";

/**
 * JWT signing secret for Edge (`middleware`) and Node (`/api/auth`) — must always match.
 * Prefer `AUTH_SECRET` / `NEXTAUTH_SECRET`. If unset, uses a stable demo fallback so login works
 * locally and on previews; **set a real secret** for any public deployment.
 */
function authSecretForEnv(): string {
  const fromEnv = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (fromEnv.length > 0) return fromEnv;

  console.warn(
    "[DealSeal auth] AUTH_SECRET / NEXTAUTH_SECRET not set — using built-in demo secret. " +
      "Set AUTH_SECRET in environment for production security.",
  );
  return DEV_AUTH_SECRET_FALLBACK;
}

const sharedCallbacks: NextAuthConfig["callbacks"] = {
  async jwt({ token, user }) {
    const mutable = token as typeof token & {
      id?: string;
      role?: UserRole;
      workspaceId?: string;
    };
    if (user) {
      mutable.id = user.id;
      mutable.role = user.role;
      mutable.workspaceId = user.workspaceId;
    }
    return mutable;
  },
  async session({ session, token }) {
    const typed = token as typeof token & {
      id?: string;
      role?: UserRole;
      workspaceId?: string;
    };
    if (session.user) {
      session.user.id = typed.id ?? "";
      session.user.role = typed.role ?? "DEALER_USER";
      session.user.workspaceId =
        typed.workspaceId ?? demoWorkspaceIdForRole((typed.role ?? "DEALER_USER") as UserRole);
    }
    return session;
  },
};

/**
 * Edge-safe auth config (no Prisma / Node-only imports).
 * Returns a *new* object each time: NextAuth’s setEnvDefaults mutates the config; a shared
 * singleton was causing empty/corrupt `secret` and generic "Configuration" errors.
 * `useSecureCookies` follows URL envs (see `cookie-security.ts`) so http://localhost + `next start` works.
 */
export function createAuthConfig(): NextAuthConfig {
  return {
    trustHost: true,
    useSecureCookies: secureSessionCookies(),
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [],
    secret: authSecretForEnv(),
    callbacks: sharedCallbacks,
  };
}
