/**
 * In-process sliding-window rate limiter.
 *
 * Used to protect endpoints where an unmetered caller costs real money or
 * enables abuse - most importantly the AI tutor, which spends Anthropic
 * tokens on every request.
 *
 * A sliding window (rather than a fixed counter that resets on a boundary) is
 * deliberate: fixed counters let a caller burst twice the limit across a
 * boundary. Each key keeps the timestamps of its recent requests and older
 * entries age out individually.
 *
 * Scope: this is per-process state. It is the right tool for a single-instance
 * study lab. A multi-instance deployment needs a shared store (Redis or the
 * database) so the limit is enforced across instances.
 */

/** A rate limit: at most `limit` requests per `windowMs` of trailing time. */
export type RateLimitConfig = {
  readonly limit: number;
  readonly windowMs: number;
};

export type RateLimitResult = {
  /** Whether this request is permitted. */
  readonly allowed: boolean;
  /** Requests still available in the current window (0 when blocked). */
  readonly remaining: number;
  /** Seconds until capacity frees up. Always >= 1 when blocked, else 0. */
  readonly retryAfterSeconds: number;
};

/**
 * Named limits, so callers reference a policy rather than inlining numbers.
 *
 * `tutor` sits at the 10/min ceiling the security standard sets for sensitive
 * endpoints; it is a per-user limit, and normal study use is well below it.
 */
export const RATE_LIMITS = {
  tutor: { limit: 10, windowMs: 60_000 },
  signup: { limit: 5, windowMs: 60_000 },
  /** Lab code execution forks a process, so cap the burst on a short window. */
  labRun: { limit: 10, windowMs: 10_000 },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * A key's recent request timestamps, together with the window they are measured
 * against. The window is stored per bucket because different policies have
 * different windows: sweeping every key against whichever policy happens to be
 * checking would age out a long-window key early and make its limit
 * unenforceable.
 */
type Bucket = {
  readonly windowMs: number;
  readonly timestamps: readonly number[];
};

/** Buckets per key. Replaced, never mutated in place. */
const buckets = new Map<string, Bucket>();

/**
 * Drop buckets with no entries left inside their own window, so keys that stop
 * being used (a signed-out user, a one-off IP) do not accumulate forever.
 */
function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    const live = bucket.timestamps.filter((t) => now - t < bucket.windowMs);
    if (live.length === 0) {
      buckets.delete(key);
    } else if (live.length !== bucket.timestamps.length) {
      buckets.set(key, { windowMs: bucket.windowMs, timestamps: live });
    }
  }
}

/**
 * Record a request against `key` and report whether it is allowed.
 *
 * `now` is injectable so the behaviour is testable without faking timers;
 * callers in production omit it.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): RateLimitResult {
  const { limit, windowMs } = config;

  sweepExpired(now);

  // Only requests inside the trailing window count toward the limit. The sweep
  // above has already pruned this key; re-filtering guards against a policy
  // whose window shrank since the bucket was written.
  const recent = (buckets.get(key)?.timestamps ?? []).filter(
    (t) => now - t < windowMs,
  );

  if (recent.length >= limit) {
    // `min` rather than `recent[0]`: entries are appended in call order, so the
    // first is normally the oldest, but a clock step backwards would break that.
    const oldest = Math.min(...recent);
    const msUntilFree = oldest + windowMs - now;

    // Keep the pruned list so an expiring entry is not re-counted later. A
    // blocked request is deliberately NOT recorded, so hammering the endpoint
    // cannot extend the caller's own lockout.
    buckets.set(key, { windowMs, timestamps: recent });

    return {
      allowed: false,
      remaining: 0,
      // Round up, and never advertise 0 - a client told to retry in 0s hot-loops.
      retryAfterSeconds: Math.max(1, Math.ceil(msUntilFree / 1000)),
    };
  }

  // New array rather than pushing into the stored one.
  buckets.set(key, { windowMs, timestamps: [...recent, now] });

  return {
    allowed: true,
    remaining: limit - recent.length - 1,
    retryAfterSeconds: 0,
  };
}

/** Clear all limiter state. Test-only. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Keys currently tracked. Test-only introspection. */
export function trackedKeys(): readonly string[] {
  return [...buckets.keys()];
}

/**
 * Rate-limit key for an unauthenticated caller, derived from its address.
 *
 * Reads the proxy headers rather than a connection address because Next route
 * handlers do not expose the socket. Behind a proxy these headers are
 * spoofable, so this is a throttle on casual abuse, not an identity check -
 * anything that must be trustworthy belongs behind authentication.
 */
export function clientIpKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstHop = forwarded?.split(",")[0]?.trim();
  if (firstHop) {
    return firstHop;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
