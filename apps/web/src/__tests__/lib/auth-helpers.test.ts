import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// `auth.ts` pulls in next-auth, which cannot resolve `next/server` under jsdom.
// Only `isAuthBypassed` is under test here and it never touches the session.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { isAuthBypassed } from "@/lib/auth-helpers";

/**
 * `NODE_ENV` is typed read-only, so it is set through `vi.stubEnv` rather than
 * by assignment. The other variables go through the same helper for consistency.
 */
function setEnv(env: {
  nodeEnv: "development" | "production" | "test";
  databaseUrl?: string;
  skipAuth?: string;
  allowBypass?: string;
}) {
  vi.stubEnv("NODE_ENV", env.nodeEnv);
  vi.stubEnv("DATABASE_URL", env.databaseUrl ?? "");
  vi.stubEnv("SKIP_AUTH", env.skipAuth ?? "");
  vi.stubEnv("ALLOW_AUTH_BYPASS", env.allowBypass ?? "");
}

const DB = "postgresql://localhost:5432/studylab";

describe("isAuthBypassed", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is bypassed when there is no database to authenticate against", () => {
    setEnv({ nodeEnv: "development" });

    expect(isAuthBypassed()).toBe(true);
  });

  it("is bypassed when SKIP_AUTH is set, even with a database", () => {
    setEnv({ nodeEnv: "development", databaseUrl: DB, skipAuth: "true" });

    expect(isAuthBypassed()).toBe(true);
  });

  it("is not bypassed when a database is configured", () => {
    setEnv({ nodeEnv: "development", databaseUrl: DB });

    expect(isAuthBypassed()).toBe(false);
  });

  it("treats an empty DATABASE_URL as absent", () => {
    setEnv({ nodeEnv: "development", databaseUrl: "" });

    expect(isAuthBypassed()).toBe(true);
  });

  it("only honours the literal string 'true' for SKIP_AUTH", () => {
    for (const value of ["1", "yes", "TRUE", "false", ""]) {
      setEnv({ nodeEnv: "development", databaseUrl: DB, skipAuth: value });

      expect(isAuthBypassed()).toBe(false);
    }
  });

  // The important cases: in production, a bypass must be asserted, never
  // inferred from a variable that simply failed to be set.
  it("throws in production rather than silently disabling auth", () => {
    setEnv({ nodeEnv: "production" });

    expect(() => isAuthBypassed()).toThrow(/ALLOW_AUTH_BYPASS/);
  });

  it("throws in production when SKIP_AUTH is set without the opt-in", () => {
    setEnv({ nodeEnv: "production", databaseUrl: DB, skipAuth: "true" });

    expect(() => isAuthBypassed()).toThrow(/ALLOW_AUTH_BYPASS/);
  });

  it("allows an explicitly asserted bypass in production", () => {
    setEnv({ nodeEnv: "production", allowBypass: "true" });

    expect(isAuthBypassed()).toBe(true);
  });

  it("does not throw in production when auth is actually active", () => {
    setEnv({ nodeEnv: "production", databaseUrl: DB });

    expect(isAuthBypassed()).toBe(false);
  });
});
