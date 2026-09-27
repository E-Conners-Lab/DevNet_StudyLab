import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimits,
  trackedKeys,
  clientIpKey,
  RATE_LIMITS,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  const config = { limit: 3, windowMs: 60_000 };

  it("allows requests up to the limit", () => {
    const results = [0, 1, 2].map((i) =>
      checkRateLimit("user-a", config, 1_000 + i),
    );

    expect(results.map((r) => r.allowed)).toEqual([true, true, true]);
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("user-a", config, 1_000 + i);
    }

    const blocked = checkRateLimit("user-a", config, 1_010);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports remaining allowance as it is consumed", () => {
    expect(checkRateLimit("user-a", config, 1_000).remaining).toBe(2);
    expect(checkRateLimit("user-a", config, 1_001).remaining).toBe(1);
    expect(checkRateLimit("user-a", config, 1_002).remaining).toBe(0);
  });

  it("tracks each key independently", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("user-a", config, 1_000 + i);
    }

    expect(checkRateLimit("user-a", config, 1_003).allowed).toBe(false);
    expect(checkRateLimit("user-b", config, 1_003).allowed).toBe(true);
  });

  it("slides the window rather than resetting on a fixed boundary", () => {
    // Three requests at the very start of the window.
    for (let i = 0; i < 3; i++) {
      checkRateLimit("user-a", config, 1_000 + i);
    }
    expect(checkRateLimit("user-a", config, 30_000).allowed).toBe(false);

    // Once those three age out of the trailing window, capacity returns -
    // and it returns gradually, not all at once as a fixed counter would.
    expect(checkRateLimit("user-a", config, 61_001).allowed).toBe(true);
    expect(checkRateLimit("user-a", config, 61_002).allowed).toBe(true);
    expect(checkRateLimit("user-a", config, 61_003).allowed).toBe(true);
    expect(checkRateLimit("user-a", config, 61_004).allowed).toBe(false);
  });

  it("returns a retry-after that covers the oldest request in the window", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("user-a", config, 1_000);
    }

    const blocked = checkRateLimit("user-a", config, 31_000);

    // Oldest entry is at t=1000, so the window frees up at t=61000: 30s out.
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it("never reports a retry-after below one second", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("user-a", config, 1_000);
    }

    const blocked = checkRateLimit("user-a", config, 60_999);

    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate the caller's config", () => {
    const frozen = Object.freeze({ limit: 2, windowMs: 1_000 });

    expect(() => checkRateLimit("user-a", frozen, 1_000)).not.toThrow();
  });

  it("evicts keys whose entries have all expired", () => {
    checkRateLimit("stale-key", config, 1_000);

    // A later call for a different key triggers a sweep of expired buckets.
    checkRateLimit("other-key", config, 500_000);

    expect(trackedKeys()).not.toContain("stale-key");
    expect(trackedKeys()).toContain("other-key");
  });
});

describe("RATE_LIMITS", () => {
  it("defines a tutor limit at or below the 10/min auth-endpoint ceiling", () => {
    expect(RATE_LIMITS.tutor.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.tutor.windowMs).toBe(60_000);
  });
});

describe("clientIpKey", () => {
  it("uses the first hop of x-forwarded-for", () => {
    const request = new Request("http://localhost/api/auth/signup", {
      headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.1" },
    });

    expect(clientIpKey(request)).toBe("203.0.113.7");
  });

  it("trims whitespace around the forwarded address", () => {
    const request = new Request("http://localhost/api/auth/signup", {
      headers: { "x-forwarded-for": "  203.0.113.7  " },
    });

    expect(clientIpKey(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost/api/auth/signup", {
      headers: { "x-real-ip": "203.0.113.9" },
    });

    expect(clientIpKey(request)).toBe("203.0.113.9");
  });

  it("returns a stable placeholder when no address header is present", () => {
    const request = new Request("http://localhost/api/auth/signup");

    expect(clientIpKey(request)).toBe("unknown");
  });

  it("ignores an empty x-forwarded-for rather than keying on empty string", () => {
    const request = new Request("http://localhost/api/auth/signup", {
      headers: { "x-forwarded-for": "", "x-real-ip": "203.0.113.4" },
    });

    expect(clientIpKey(request)).toBe("203.0.113.4");
  });
});

describe("checkRateLimit - multiple policies", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  const longWindow = { limit: 3, windowMs: 60_000 };
  const shortWindow = { limit: 5, windowMs: 1_000 };

  it("does not let a short-window policy free capacity for a long-window key", () => {
    // Exhaust the long-window key.
    for (let i = 0; i < 3; i++) {
      checkRateLimit("tutor:user-a", longWindow, 1_000);
    }
    expect(checkRateLimit("tutor:user-a", longWindow, 1_100).allowed).toBe(false);

    // A single check under a 1s-window policy must not age out the tutor
    // entries just because its own window is shorter.
    checkRateLimit("labrun:user-a", shortWindow, 5_000);

    expect(checkRateLimit("tutor:user-a", longWindow, 5_001).allowed).toBe(false);
  });

  it("keeps each key on its own window when both are active", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("labrun:user-a", shortWindow, 1_000);
    }
    for (let i = 0; i < 3; i++) {
      checkRateLimit("tutor:user-a", longWindow, 1_000);
    }

    // At t=3s the 1s window has cleared but the 60s window has not.
    expect(checkRateLimit("labrun:user-a", shortWindow, 3_000).allowed).toBe(true);
    expect(checkRateLimit("tutor:user-a", longWindow, 3_000).allowed).toBe(false);
  });

  it("evicts a key only once its own window has elapsed", () => {
    checkRateLimit("tutor:user-a", longWindow, 1_000);

    // A short-window check well past 1s must not evict the tutor bucket.
    checkRateLimit("labrun:user-b", shortWindow, 10_000);

    expect(trackedKeys()).toContain("tutor:user-a");
  });
});
