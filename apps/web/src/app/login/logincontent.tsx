"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  const { register, handleSubmit } = useForm<LoginInput>({
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
    router.replace(sp.get("next") || "/dashboard");
  });

  return (
    <div className="card" style={{ width: "100%", maxWidth: 420, margin: "3rem auto" }}>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Use scaffold credentials to enter your workspace.</p>
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
    </div>
  );
}