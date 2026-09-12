import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  // Re-mock after reset. A real class is required: the route calls
  // `new Anthropic(...)` and checks `instanceof Anthropic.APIError`.
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
