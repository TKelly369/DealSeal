"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";
import { loginWithPassword, saveSessionFromLogin } from "@/lib/auth-api";

export default function LoginPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      setLoading(true);
      try {
        const res = await loginWithPassword(email, password);
        saveSessionFromLogin(res);
        const next = sp.get("next");
        router.replace(next && next.startsWith("/") ? next : "/dashboard");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Login failed");
      } finally {
        setLoading(false);
      }
    },
    [email, password, router, sp],
  );

  return (
    <div className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
      <h1>Sign in</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>DealSeal™ — use your work email and password.</p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: "100%", display: "block" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
            autoComplete="current-password"
            style={{ width: "100%", display: "block" }}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "…" : "Sign in"}
        </button>
      </form>
      <p style={{ fontSize: 14, marginTop: "1rem" }}>
        No account? <Link href="/register">Create organization</Link>
      </p>
    </div>
  );
}
