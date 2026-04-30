"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { beginLoginAuditTrail, resolvePostLoginDestinationForSession } from "./actions";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  /** Optional for sign-in; used for post-login audit when provided. */
  fullName: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
});

type LoginInput = z.infer<typeof LoginSchema>;

function signInErrorToMessage(err: string | undefined): string {
  if (!err) {
    return "Sign-in could not start (network or config). Check the browser devtools console and that /api/auth responds.";
  }
  if (err === "CredentialsSignin" || err === "CallbackRouteError") {
    return "Invalid credentials. Use the scaffolded demo accounts below.";
  }
  if (err === "Configuration" || err === "MissingSecret") {
    return "Server auth is misconfigured: set AUTH_SECRET (or NEXTAUTH_SECRET) in apps/web/.env.local and restart. In development, a built-in dev secret is used if those are empty.";
  }
  return `Sign-in failed: ${err}`;
}

function sanitizeNextPath(requestedNext: string | null, fallback: string): string {
  if (!requestedNext) return fallback;
  return requestedNext.startsWith("/") ? requestedNext : fallback;
}

export type LoginContentProps = {
  /** Scoped sign-in: pre-fills demo account and default `next` when no `?next=` is present. */
  variant?: "default" | "dealer" | "lender" | "admin";
};

const VARIANT_CONFIG = {
  default: {
    heading: "Sign in",
    hint: "Confirm identity and sign in on one screen to begin the audit trail.",
    email: "user@dealseal1.com",
    defaultNext: "/dashboard" as const,
  },
  dealer: {
    heading: "Dealer sign in",
    hint: "Access your dealership workspace, deals, and lender submissions.",
    email: "dealer.admin@dealseal1.com",
    defaultNext: "/dealer" as const,
  },
  lender: {
    heading: "Lender sign in",
    hint: "Access lender intake, assets, pools, and funding workflows.",
    email: "lender.admin@dealseal1.com",
    defaultNext: "/lender" as const,
  },
  admin: {
    heading: "Admin sign in",
    hint: "Platform and governance console (users, audit, configuration).",
    email: "admin@dealseal1.com",
    defaultNext: "/admin" as const,
  },
} as const;

export default function LoginContent({ variant = "default" }: LoginContentProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const cfg = VARIANT_CONFIG[variant];
  const { register, handleSubmit, setValue } = useForm<LoginInput>({
    defaultValues: {
      email: cfg.email,
      password: "dealseal123",
      fullName: "Demo user",
      title: "",
      phone: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const parsed = LoginSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid login input.");
      return;
    }
    setLoading(true);
    let res: Awaited<ReturnType<typeof signIn>> | null = null;
    try {
      res = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Sign-in failed to complete.");
      return;
    }
    setLoading(false);
    if (res == null) {
      setError(
        "Sign-in did not return a result (e.g. provider not loaded). If the page reloaded, check the URL for error=; otherwise confirm AUTH_SECRET in .env.local and restart the dev server.",
      );
      return;
    }
    if (res.error || res.ok === false) {
      setError(signInErrorToMessage(res.error));
      return;
    }
    const requestedNext = sanitizeNextPath(sp.get("next"), cfg.defaultNext);
    const freshSession = await getSession();
    const currentUser = freshSession?.user;
    const nextPath =
      currentUser?.id && currentUser?.workspaceId && currentUser?.role
        ? await resolvePostLoginDestinationForSession({
            requestedNext,
            userId: currentUser.id,
            role: currentUser.role,
            workspaceId: currentUser.workspaceId,
          })
        : requestedNext;

    // Ensure protected-route middleware sees identity confirmation immediately.
    document.cookie = "ds_identity_ok=1; Path=/; Max-Age=43200; SameSite=Lax";

    // Best-effort server audit write; do not block successful sign-in navigation.
    void beginLoginAuditTrail({
      fullName: parsed.data.fullName?.trim() ?? "",
      title: parsed.data.title,
      phone: parsed.data.phone,
      loginPath: nextPath,
    });

    router.replace(nextPath);
  });

  const showAllPortals = variant === "default";

  return (
    <div className="card" style={{ width: "100%", maxWidth: 420, margin: "3rem auto" }}>
      <h1 style={{ marginTop: 0 }}>{cfg.heading}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{cfg.hint}</p>
      {showAllPortals ? (
        <div className="row" style={{ marginBottom: "0.75rem", gap: "0.35rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setValue("email", "dealer.admin@dealseal1.com");
              setValue("password", "dealseal123");
            }}
          >
            Dealer Login
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setValue("email", "lender.admin@dealseal1.com");
              setValue("password", "dealseal123");
            }}
          >
            Lender Login
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setValue("email", "admin@dealseal1.com");
              setValue("password", "dealseal123");
            }}
          >
            Admin Login
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setValue("email", "platform.admin@dealseal1.com");
              setValue("password", "dealseal123");
            }}
          >
            Super admin
          </button>
        </div>
      ) : (
        <p style={{ margin: "0 0 0.75rem", fontSize: 13 }}>
          <a href="/login" style={{ color: "var(--muted)" }}>
            Other sign-in portals →
          </a>
        </p>
      )}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Email
          <input type="email" {...register("email")} />
        </label>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Password
          <input type="password" {...register("password")} />
        </label>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Full name
          <input type="text" {...register("fullName")} />
        </label>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Title / role
          <input type="text" {...register("title")} placeholder="Finance Manager, F&I, Compliance Officer..." />
        </label>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Direct phone
          <input type="text" {...register("phone")} placeholder="+1 (555) 555-5555" />
        </label>
        {error ? (
          <p style={{ margin: 0, color: "#fecaca", border: "1px solid var(--danger)", padding: "0.5rem", borderRadius: 8 }}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0, marginTop: "0.75rem" }}>
        Demo user: user@dealseal1.com / dealseal123
      </p>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0 }}>
        Dealer: dealer.admin@… · Lender: lender.admin@… · Admin: admin@… · Super: platform.admin@…
      </p>
      <div className="row" style={{ marginTop: "0.6rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <a href="/login/recover" style={{ fontSize: 12 }}>
          Forgot password or username?
        </a>
        <a href="/signup" style={{ fontSize: 12 }}>
          Create an organization
        </a>
      </div>
    </div>
  );
}