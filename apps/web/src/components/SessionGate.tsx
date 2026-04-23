"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function SessionGate({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const sp = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (PUBLIC_PATHS.has(path)) {
      if (t) {
        const next = sp.get("next");
        router.replace(next && next.startsWith("/") ? next : "/dashboard");
        return;
      }
      setReady(true);
      return;
    }
    if (!t) {
      const q = path && path !== "/login" && path !== "/dashboard" ? `?next=${encodeURIComponent(path)}` : "";
      router.replace(`/login${q}`);
      return;
    }
    setReady(true);
  }, [path, router, sp]);

  if (!ready) {
    return (
      <div
        className="card"
        style={{ maxWidth: 420, margin: "4rem auto", textAlign: "center", color: "var(--muted)" }}
      >
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
