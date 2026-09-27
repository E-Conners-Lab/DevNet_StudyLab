/**
 * Server-side auth helpers for API routes.
 *
 * Provides `getCurrentUserId()` which safely returns the authenticated
 * user's ID from the JWT session, or null when auth is bypassed
 * (SKIP_AUTH mode) or unavailable.
 */

import { auth } from "./auth";

/**
 * Whether authentication is switched off for this process.
 *
 * True in two cases: E2E test runs (`SKIP_AUTH=true`) and single-user local use
 * with no database configured. In both, there is no account to authenticate
 * against, so `getCurrentUserId()` returns null for reasons that have nothing
 * to do with the caller being unauthorized.
 *
 * Endpoints that must reject anonymous callers use this to tell the two cases
 * apart: a null user id while auth is bypassed means "no accounts here", while
 * a null user id with auth active means "not signed in" and should be a 401.
 */
export function isAuthBypassed(): boolean {
  const bypass =
    process.env.SKIP_AUTH === "true" || !process.env.DATABASE_URL;

  // `!DATABASE_URL` infers a security decision from a *missing* variable, which
  // fails open: a secret that was not mounted, a typo in the variable name, or a
  // platform that supplies a differently-named URL would all silently serve the
  // app with authentication switched off. In production the bypass therefore has
  // to be asserted rather than inferred. Throwing denies access (the callers'
  // error handling turns it into a generic failure), which is the safe direction.
  if (
    bypass &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_AUTH_BYPASS !== "true"
  ) {
    throw new Error(
      "Authentication would be bypassed in production. Set DATABASE_URL to " +
        "enable authentication, or set ALLOW_AUTH_BYPASS=true to confirm an " +
        "intentionally open deployment.",
    );
  }

  return bypass;
}

/**
 * Returns the current user's ID from the JWT session.
 * Returns null when auth is bypassed or the user is not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  // When auth is skipped (E2E tests, no DB), there's no session
  if (isAuthBypassed()) {
    return null;
  }

  try {
    const session = await auth();
    return (session?.user?.id as string) ?? null;
  } catch {
    return null;
  }
}
