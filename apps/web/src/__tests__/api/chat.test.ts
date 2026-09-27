import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock auth-helpers so the route's session lookup never loads next-auth, which
// cannot resolve `next/server` under the jsdom test environment.
vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue(null),
  isAuthBypassed: () => true,
}));

// Mock the Anthropic SDK before importing the route
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    static APIError = class extends Error {};
    messages = { stream: vi.fn() };
  }
  return { default: MockAnthropic };
});

// We need to dynamically import the route after setting up env vars
// because the route reads process.env at call time
type StreamEvent = Record<string, unknown>;

const DEFAULT_EVENTS: StreamEvent[] = [
  { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
];

async function importRoute(events: StreamEvent[] = DEFAULT_EVENTS) {
  // Clear module cache to get fresh import
  vi.resetModules();

  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield* events;
    },
  };
  const streamMock = vi.fn().mockResolvedValue(mockStream);

  // Re-mock after reset. These tests run in the auth-bypassed mode (no
  // DATABASE_URL), which is how the local single-user lab runs.
  vi.doMock("@/lib/auth-helpers", () => ({
    getCurrentUserId: vi.fn().mockResolvedValue(null),
    isAuthBypassed: () => true,
  }));

  // A real class is required: the route calls `new Anthropic(...)` and checks
  // `instanceof Anthropic.APIError`.
  vi.doMock("@anthropic-ai/sdk", () => {
    class MockAnthropic {
      static APIError = class extends Error {};
      messages = { stream: streamMock };
    }
    return { default: MockAnthropic };
  });

  const mod = await import("@/app/api/chat/route");
  return { ...mod, streamMock };
}

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns a helpful message when TUTOR_ANTHROPIC_KEY is not set", async () => {
    delete process.env.TUTOR_ANTHROPIC_KEY;

    const { POST } = await importRoute();
    const request = createRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request as never);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("not configured");
  });

  it("returns 400 for missing messages array", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute();
    const request = createRequest({ domain: "apis" });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Messages array is required");
  });

  it("returns 400 for empty messages array", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute();
    const request = createRequest({ messages: [] });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Messages array is required");
  });

  it("returns 400 when messages is not an array", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute();
    const request = createRequest({ messages: "not-an-array" });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Messages array is required");
  });

  it("returns 400 when message is missing role or content", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute();
    const request = createRequest({
      messages: [{ role: "user" }], // Missing content
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("role and content");
  });

  it("returns 400 when message role is invalid", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute();
    const request = createRequest({
      messages: [{ role: "system", content: "Hello" }],
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("role must be");
  });

  it("calls the current Claude model with adaptive thinking", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST, streamMock } = await importRoute();
    const request = createRequest({
      messages: [{ role: "user", content: "What is REST?" }],
      domain: "apis",
    });

    const response = await POST(request as never);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("Hello");
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(streamMock.mock.calls[0][0]).toMatchObject({
      model: "claude-opus-5",
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: "What is REST?" }],
    });
    expect(streamMock.mock.calls[0][0].model).not.toMatch(/\d{8}$/);
  });

  it("appends a notice when the model refuses", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRoute([
      { type: "message_delta", delta: { stop_reason: "refusal" } },
    ]);
    const request = createRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request as never);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("can't help with that request");
  });
});

describe("POST /api/chat - access control", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * Import the route with auth active (auth is not bypassed) and a stubbed
   * session user.
   *
   * Returns `streamMock` so a test can assert the Anthropic API was or was not
   * reached, and `setUser` so a test can change the signed-in user *without*
   * resetting modules - the rate limiter is module state, so resetting would
   * discard it and any cross-user assertion would pass vacuously.
   */
  async function importRouteWithUser(userId: string | null) {
    vi.resetModules();

    const streamMock = vi.fn().mockImplementation(async () => ({
      [Symbol.asyncIterator]: async function* () {
        yield* DEFAULT_EVENTS;
      },
    }));

    vi.doMock("@anthropic-ai/sdk", () => {
      class MockAnthropic {
        static APIError = class extends Error {};
        messages = { stream: streamMock };
      }
      return { default: MockAnthropic };
    });

    const getCurrentUserId = vi.fn().mockResolvedValue(userId);

    vi.doMock("@/lib/auth-helpers", () => ({
      getCurrentUserId,
      isAuthBypassed: () => false,
    }));

    const mod = await import("@/app/api/chat/route");
    const { resetRateLimits } = await import("@/lib/rate-limit");
    resetRateLimits();

    return {
      ...mod,
      streamMock,
      setUser: (next: string | null) =>
        getCurrentUserId.mockResolvedValue(next),
    };
  }

  it("returns 401 when no user is signed in and auth is active", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRouteWithUser(null);
    const response = await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Sign in");
  });

  it("does not reach the Anthropic API when unauthenticated", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST, streamMock } = await importRouteWithUser(null);
    await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );

    expect(streamMock).not.toHaveBeenCalled();

    // The gate also runs before the rate limiter, so a rejected caller does not
    // consume anyone's quota.
    const { trackedKeys } = await import("@/lib/rate-limit");
    expect(trackedKeys()).toEqual([]);
  });

  it("allows a signed-in user through", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRouteWithUser("user-1");
    const response = await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello");
  });

  it("returns 429 with Retry-After once the per-user limit is exceeded", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST } = await importRouteWithUser("user-1");
    const { RATE_LIMITS } = await import("@/lib/rate-limit");

    for (let i = 0; i < RATE_LIMITS.tutor.limit; i++) {
      const ok = await POST(
        createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
      );
      expect(ok.status).toBe(200);
    }

    const blocked = await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );
    const data = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(data.error).toContain("limit");
  });

  it("limits each user separately", async () => {
    process.env.TUTOR_ANTHROPIC_KEY = "test-key-123";

    const { POST, setUser } = await importRouteWithUser("user-1");
    const { RATE_LIMITS } = await import("@/lib/rate-limit");

    // Exhaust user-1 through the route itself, so the limiter state under test
    // is the one the route actually uses.
    for (let i = 0; i < RATE_LIMITS.tutor.limit; i++) {
      await POST(
        createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
      );
    }
    const blocked = await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );
    expect(blocked.status).toBe(429);

    // Same module instance, same limiter state - only the user changes.
    setUser("user-2");
    const response = await POST(
      createRequest({ messages: [{ role: "user", content: "Hi" }] }) as never,
    );

    expect(response.status).toBe(200);
  });
});
