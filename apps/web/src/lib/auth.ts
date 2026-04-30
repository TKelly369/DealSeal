import NextAuth, { type DefaultSession, type User as NextAuthUser } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { UserRole } from "@/generated/prisma";
import { createAuthConfig } from "@/lib/auth.config";

/** Node-only entry: Prisma and Node `crypto` are loaded only inside `authorize` via dynamic import. Do not import this file from `middleware.ts`. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      workspaceId: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: UserRole;
    workspaceId: string;
  }
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MOCK_USERS: {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  workspaceId: string;
}[] = [
  {
    id: "user-001",
    email: "user@dealseal1.com",
    password: "dealseal123",
    name: "DealSeal User",
    role: "DEALER_USER",
    workspaceId: "workspace-main",
  },
  {
    id: "admin-001",
    email: "admin@dealseal1.com",
    password: "dealseal123",
    name: "DealSeal Admin",
    role: "ADMIN_USER",
    workspaceId: "ws-dealseal-internal",
  },
  {
    id: "dealer-admin-001",
    email: "dealer.admin@dealseal1.com",
    password: "dealseal123",
    name: "Dealer Manager",
    role: "DEALER_MANAGER",
    workspaceId: "workspace-main",
  },
  {
    id: "lender-admin-001",
    email: "lender.admin@dealseal1.com",
    password: "dealseal123",
    name: "Lender Manager",
    role: "LENDER_MANAGER",
    workspaceId: "ws-lender-demo",
  },
  {
    id: "platform-admin-001",
    email: "platform.admin@dealseal1.com",
    password: "dealseal123",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    workspaceId: "ws-dealseal-internal",
  },
  {
    id: "dealer-sales-001",
    email: "dealer.sales@dealseal1.com",
    password: "dealseal123",
    name: "Dealer Sales",
    role: "DEALER_USER",
    workspaceId: "workspace-main",
  },
  {
    id: "dealer-mgr-001",
    email: "dealer.manager@dealseal1.com",
    password: "dealseal123",
    name: "Dealer Manager",
    role: "DEALER_MANAGER",
    workspaceId: "workspace-main",
  },
  {
    id: "lender-rep-001",
    email: "lender.rep@dealseal1.com",
    password: "dealseal123",
    name: "Lender User",
    role: "LENDER_USER",
    workspaceId: "ws-lender-demo",
  },
  {
    id: "lender-mgr-001",
    email: "lender.manager@dealseal1.com",
    password: "dealseal123",
    name: "Lender Manager",
    role: "LENDER_MANAGER",
    workspaceId: "ws-lender-demo",
  },
  {
    id: "admin-sys-001",
    email: "admin.ops@dealseal1.com",
    password: "dealseal123",
    name: "Custodian Admin",
    role: "CUSTODIAN_ADMIN",
    workspaceId: "ws-dealseal-internal",
  },
  {
    id: "admin-mgr-001",
    email: "admin.manager@dealseal1.com",
    password: "dealseal123",
    name: "Admin Manager",
    role: "ADMIN_USER",
    workspaceId: "ws-dealseal-internal",
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...createAuthConfig(),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw): Promise<NextAuthUser | null> {
        try {
          const parsed = CredentialsSchema.safeParse(raw);
          if (!parsed.success) return null;
          const normalizedEmail = parsed.data.email.toLowerCase();
          const password = parsed.data.password;

          // Optional DB-backed password override. Must not run before (or without) a successful
          // Prisma import — if Prisma fails to load (e.g. query engine EPERM) or DB is down,
          // we still allow scaffolded MOCK_USERS to sign in.
          try {
            const { prisma } = await import("@/lib/db");
            const { verifySecret } = await import("@/lib/security");
            const override = await prisma.userLoginOverride.findUnique({
              where: { email: normalizedEmail },
            });

            if (override && verifySecret(password, override.passwordHash)) {
              const foundOverrideUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
              if (foundOverrideUser) {
                const u = foundOverrideUser;
                return {
                  id: u.id,
                  email: u.email,
                  name: u.name,
                  role: u.role,
                  workspaceId: u.workspaceId,
                } as NextAuthUser;
              }
            }
          } catch {
            // Prisma/DB override unavailable — continue with scaffold credentials.
          }

          if (process.env.NODE_ENV !== "production") {
            const found = MOCK_USERS.find(
              (u) => u.email.toLowerCase() === normalizedEmail && u.password === password,
            );
            if (found) {
              return {
                id: found.id,
                email: found.email,
                name: found.name,
                role: found.role,
                workspaceId: found.workspaceId,
              } as NextAuthUser;
            }
          }
        } catch {
          return null;
        }
        return null;
      },
    }),
  ],
});
