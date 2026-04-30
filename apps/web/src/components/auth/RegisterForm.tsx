"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";
import { registerAccount, saveSessionFromLogin } from "@/lib/auth-api";

export function RegisterForm({ loginHref = "/login" }: { loginHref?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      if (password.length < 10) {
        setErr("Password must be at least 10 characters.");
        return;
      }
      setLoading(true);
      try {
        const res = await registerAccount({
          email,
          password,
          displayName,
          organizationName,
          organizationSlug: organizationSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        });
        saveSessionFromLogin(res);
        router.replace("/dashboard");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Registration failed");
      } finally {
        setLoading(false);
      }
    },
    [email, password, displayName, organizationName, organizationSlug, router],
  );

  return (
    <div className="card" style={{ maxWidth: 440, margin: "2rem auto" }}>
      <h1>Create organization</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        You will be the org admin. Slug: lowercase URL segment (e.g. my-dealer-1).
      </p>
      {err ? <p style={{ color: "var(--danger)" }}>{err}</p> : null}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Your name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={1} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password (10+ characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label>
          Organization name
          <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
        </label>
        <label>
          Organization slug
          <input
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9-]+"
            title="a-z, 0-9, hyphens"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "…" : "Register"}
        </button>
      </form>
      <p style={{ fontSize: 14, marginTop: "1rem" }}>
        Already have an account? <Link href={loginHref}>Sign in</Link>
      </p>
    </div>
  );
}
