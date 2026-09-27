/**
 * Route protection proxy (formerly `middleware.ts` - Next 16 renamed the
 * convention to `proxy`; the exported function is renamed to match).
 *
 * Protects /dashboard/* routes, redirecting unauthenticated users to /login.
 *
 * Auth is bypassed when:
 * - SKIP_AUTH=true (E2E tests)
 * - DATABASE_URL is not set (no DB to authenticate against)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Skip auth when testing or when the database is unavailable
  if (
    process.env.SKIP_AUTH === "true" ||
    !process.env.DATABASE_URL
  ) {
    return NextResponse.next();
  }

  // Check for the NextAuth v5 JWT session cookie.
  // In development the cookie name is "authjs.session-token".
  // In production (HTTPS) it's "__Secure-authjs.session-token".
  const token =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
