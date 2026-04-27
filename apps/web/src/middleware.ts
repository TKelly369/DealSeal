import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/settings") || pathname.startsWith("/admin");

  if (!isProtected) return NextResponse.next();

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
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
  matcher: ["/dashboard/:path*", "/settings/:path*", "/admin/:path*"],
};
