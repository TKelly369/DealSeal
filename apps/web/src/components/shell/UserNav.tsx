"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ShellUser } from "@/components/shell/types";

export function UserNav({ user }: { user: ShellUser }) {
  return (
    <details className="ds-user-nav">
      <summary>
        <span className="ds-avatar" aria-hidden>
          {user.name
            .split(" ")
            .map((v) => v[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="ds-user-name">{user.name}</span>
        <span className="badge">{user.role}</span>
      </summary>
      <div className="ds-user-menu">
        <p style={{ margin: "0.2rem 0.45rem 0.3rem", color: "var(--muted)", fontSize: 12 }}>{user.email}</p>
        <Link href="/settings/profile">Profile</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/billing">Billing</Link>
        <button
          type="button"
          onClick={async () => {
            await signOut({ callbackUrl: "/login" });
          }}
        >
          Logout
        </button>
      </div>
    </details>
  );
}
