import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

let warnedRateLimitBypass = false;

const hasUpstashConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const rateLimiter = hasUpstashConfig
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "dealseal:api:v1",
    })
  : null;

export default auth(async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isApiV1 = pathname.startsWith("/api/v1/");

  if (isApiV1) {
    if (!rateLimiter) {
      if (!warnedRateLimitBypass) {
        console.warn("Rate limiting bypassed: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
        warnedRateLimitBypass = true;
      }
      return NextResponse.next();
    }
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const identifier =
      (token ? token.slice(0, 16) : "") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    const result = await rateLimiter.limit(identifier);
    if (!result.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    return NextResponse.next();
  }

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

  if (isProtected && pathname !== "/session-identity") {
    const hasIdentity = req.cookies.get("ds_identity_ok")?.value === "1";
    if (!hasIdentity) {
      const identityUrl = new URL("/session-identity", nextUrl.origin);
      identityUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(identityUrl);
    }
  }

  if (
    pathname.startsWith("/admin") &&
    req.auth.user.role !== "ADMIN" &&
    req.auth.user.role !== "PLATFORM_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/v1/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/dealer/:path*",
    "/lender/:path*",
    "/session-identity",
  ],
};
