import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Anthropic SDK before importing the route
vi.mock("@anthropic-ai/sdk", () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello" },
      };
    },
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockResolvedValue(mockStream),
      },
    })),
  };
});

// We need to dynamically import the route after setting up env vars
// because the route reads process.env at call time
async function importRoute() {
  // Clear module cache to get fresh import
  vi.resetModules();

  // Re-mock after reset
  vi.doMock("@anthropic-ai/sdk", () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        };
      },
    };

    return {
      default: vi.fn().mockImplementation(() => ({
        messages: {
          stream: vi.fn().mockResolvedValue(mockStream),
        },
      })),
    };
  });

  const mod = await import("@/app/api/chat/route");
  return mod;
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
});
