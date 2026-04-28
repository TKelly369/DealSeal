import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/auth.config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

let warnedRateLimitBypass = false;
let rateLimiter: Ratelimit | null = null;

const hasUpstashConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

if (hasUpstashConfig) {
  try {
    rateLimiter = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "dealseal:api:v1",
    });
  } catch (e) {
    console.warn("Upstash rate limiter init failed, bypassing /api/v1 rate limits.", e);
    rateLimiter = null;
  }
}

/**
 * Best-effort client id for rate limiting (prefer first hop in x-forwarded-for, then x-real-ip).
 * `req.ip` is not always set on the Edge request object.
 */
function getRateLimitId(req: NextRequest): string {
  const fromForwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fromForwarded) return fromForwarded.slice(0, 64);
  const fromReal = req.headers.get("x-real-ip")?.trim();
  if (fromReal) return fromReal.slice(0, 64);
  return "anonymous";
}

/**
 * One NextAuth instance for middleware: Edge-safe config only (from `createAuthConfig`).
 * `apps/web/src/lib/auth.ts` (Prisma) must never be imported here.
 */
const { auth } = NextAuth(createAuthConfig());

function nextWithPathname(req: NextRequest, pathname: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-dealseal-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // 1) /api/v1: rate limit first, then hand off to the route (401/403 is handled in route handlers, not here).
  if (pathname.startsWith("/api/v1/")) {
    if (!rateLimiter) {
      if (!warnedRateLimitBypass) {
        console.warn(
          "Rate limiting bypassed: missing/invalid Upstash (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) or init failed",
        );
        warnedRateLimitBypass = true;
      }
      return NextResponse.next();
    }
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const identifier = (token ? token.slice(0, 16) : "") || getRateLimitId(req) || "anonymous";
    const result = await rateLimiter.limit(identifier);
    if (!result.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    return NextResponse.next();
  }

  // 2) Logged-in users hitting /login are sent to app only after identity is confirmed.
  if (pathname === "/login" && req.auth?.user) {
    const hasIdentity = req.cookies.get("ds_identity_ok")?.value === "1";
    if (hasIdentity) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
    }
    return NextResponse.next();
  }

  // 3) App shell routes: role checks, session-identity, admin splits.
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dealer") ||
    pathname.startsWith("/lender");

  if (!isProtected) return NextResponse.next();

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected) {
    const hasIdentity = req.cookies.get("ds_identity_ok")?.value === "1";
    if (!hasIdentity) {
      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/admin") && req.auth.user.role !== "ADMIN" && req.auth.user.role !== "PLATFORM_ADMIN") {
    const role = req.auth.user.role;
    if (role === "DEALER_ADMIN") {
      return NextResponse.redirect(new URL("/dealer/dashboard", nextUrl.origin));
    }
    if (role === "LENDER_ADMIN") {
      return NextResponse.redirect(new URL("/lender/dashboard", nextUrl.origin));
    }
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }
  return nextWithPathname(req, pathname);
});

/**
 * `/api/auth/*` is intentionally excluded so sign-in and CSRF are not run through this middleware
 * (NextAuth must run in `runtime = "nodejs"` in the route handler, not the Edge path here).
 */
export const config = {
  matcher: [
    "/api/v1/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/dealer/:path*",
    "/lender/:path*",
    "/session-identity",
    "/login",
  ],
};
