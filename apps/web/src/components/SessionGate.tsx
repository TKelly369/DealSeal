"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path === "/verify" || path.startsWith("/verify/")) return true;
  if (path.startsWith("/records/")) return true;
  return false;
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (isPublicPath(path)) {
      setReady(true);
      return;
    }
    if (!t) {
      const q = path && path !== "/login" && path !== "/dashboard" ? `?next=${encodeURIComponent(path)}` : "";
      router.replace(`/login${q}`);
      return;
    }
    setReady(true);
  }, [path, router]);

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
