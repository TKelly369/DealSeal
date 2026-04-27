"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { resolvePostLoginDestination } from "./actions";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginInput = z.infer<typeof LoginSchema>;

export default function LoginContent() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const { register, handleSubmit, setValue } = useForm<LoginInput>({
    defaultValues: { email: "user@dealseal1.com", password: "dealseal123" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const parsed = LoginSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid login input.");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials. Use scaffolded demo accounts.");
      return;
    }
    const requestedNext = sp.get("next");
    const nextPath = await resolvePostLoginDestination(requestedNext);
    router.replace(`/session-identity?next=${encodeURIComponent(nextPath)}`);
  });

  return (
    <div className="card" style={{ width: "100%", maxWidth: 420, margin: "3rem auto" }}>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Use scaffold credentials to enter your workspace.</p>
      <div className="row" style={{ marginBottom: "0.75rem", gap: "0.35rem" }}>
        <button type="button" className="btn btn-secondary" onClick={() => {
          setValue("email", "dealer.admin@dealseal1.com");
          setValue("password", "dealseal123");
        }}>
          Dealer Login
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => {
          setValue("email", "lender.admin@dealseal1.com");
          setValue("password", "dealseal123");
        }}>
          Lender Login
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => {
          setValue("email", "admin@dealseal1.com");
          setValue("password", "dealseal123");
        }}>
          Admin Login
        </button>
      </div>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Email
          <input type="email" {...register("email")} />
        </label>
        <label style={{ display: "grid", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          Password
          <input type="password" {...register("password")} />
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
        Dealer: dealer.admin@dealseal1.com · Lender: lender.admin@dealseal1.com · Admin: admin@dealseal1.com
      </p>
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <a href="/login/recover" style={{ fontSize: 12 }}>
          Forgot password or username?
        </a>
      </div>
    </div>
  );
}