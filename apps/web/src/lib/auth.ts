import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifySecret } from "@/lib/security";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN" | "DEALER_ADMIN" | "LENDER_ADMIN" | "PLATFORM_ADMIN";
      workspaceId: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: "USER" | "ADMIN" | "DEALER_ADMIN" | "LENDER_ADMIN" | "PLATFORM_ADMIN";
    workspaceId: string;
  }
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MOCK_USERS = [
  {
    id: "user-001",
    email: "user@dealseal1.com",
    password: "dealseal123",
    name: "DealSeal User",
    role: "USER" as const,
    workspaceId: "workspace-main",
  },
  {
    id: "admin-001",
    email: "admin@dealseal1.com",
    password: "dealseal123",
    name: "DealSeal Admin",
    role: "ADMIN" as const,
    workspaceId: "workspace-main",
  },
  {
    id: "dealer-admin-001",
    email: "dealer.admin@dealseal1.com",
    password: "dealseal123",
    name: "Dealer Admin",
    role: "DEALER_ADMIN" as const,
    workspaceId: "workspace-main",
  },
  {
    id: "lender-admin-001",
    email: "lender.admin@dealseal1.com",
    password: "dealseal123",
    name: "Lender Admin",
    role: "LENDER_ADMIN" as const,
    workspaceId: "ws-lender-demo",
  },
  {
    id: "platform-admin-001",
    email: "platform.admin@dealseal1.com",
    password: "dealseal123",
    name: "Platform Admin",
    role: "PLATFORM_ADMIN" as const,
    workspaceId: "workspace-main",
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const normalizedEmail = parsed.data.email.toLowerCase();

        const override = await prisma.userLoginOverride.findUnique({
          where: { email: normalizedEmail },
        });

        if (override && verifySecret(parsed.data.password, override.passwordHash)) {
          const foundOverrideUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
          if (foundOverrideUser) {
            return {
              id: foundOverrideUser.id,
              email: foundOverrideUser.email,
              name: foundOverrideUser.name,
              role: foundOverrideUser.role,
              workspaceId: foundOverrideUser.workspaceId,
            };
          }
        }

        const found = MOCK_USERS.find(
          (u) =>
            u.email.toLowerCase() === normalizedEmail &&
            u.password === parsed.data.password,
        );
        if (!found) return null;
        return {
          id: found.id,
          email: found.email,
          name: found.name,
          role: found.role,
          workspaceId: found.workspaceId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const mutable = token as typeof token & {
        id?: string;
        role?: "USER" | "ADMIN" | "DEALER_ADMIN" | "LENDER_ADMIN" | "PLATFORM_ADMIN";
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
        role?: "USER" | "ADMIN" | "DEALER_ADMIN" | "LENDER_ADMIN" | "PLATFORM_ADMIN";
        workspaceId?: string;
      };
      if (session.user) {
        session.user.id = typed.id ?? "";
        session.user.role = typed.role ?? "USER";
        session.user.workspaceId = typed.workspaceId ?? "workspace-main";
      }
      return session;
    },
  },
});
