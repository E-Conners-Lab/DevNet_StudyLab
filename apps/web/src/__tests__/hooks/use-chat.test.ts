import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "@/hooks/use-chat";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has correct initial state (empty messages, not loading)", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("adds user message immediately on send", async () => {
    // Set up a fetch that will hang (never resolve) so we can inspect
    // the intermediate state
    mockFetch.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally never resolves
        })
    );

    const { result } = renderHook(() => useChat());

    act(() => {
      // Fire and forget -- do not await since fetch never resolves
      result.current.sendMessage("What is REST?");
    });

    // The user message should be added immediately
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("What is REST?");
    expect(result.current.isLoading).toBe(true);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Test message");
    });

    expect(result.current.error).toBe("Internal server error");
    expect(result.current.isLoading).toBe(false);
    // User message should remain, but no assistant message
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Test message");
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.isLoading).toBe(false);
  });

  it("clearMessages resets state", async () => {
    // Set up a successful streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Hello"));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => useChat());

    // Send a message to populate state
    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Verify messages were added
    expect(result.current.messages.length).toBeGreaterThan(0);

    // Clear messages
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not send empty messages", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("");
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("does not send whitespace-only messages", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("falls back to a sign-in message for a 401 with no body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.reject(new Error("no json")),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // A 401 from /api/chat means "not signed in" - the route requires a session.
    // A missing API key is reported as a chat message with a 200 instead.
    expect(result.current.error).toBe("Please sign in to use the AI tutor.");
  });

  it("prefers the server's own error message over the status fallback", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Sign in to use the AI tutor." }),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.error).toBe("Sign in to use the AI tutor.");
  });

  it("surfaces the rate-limit message from a 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: "You have reached the tutor request limit. Try again in 42s.",
        }),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(result.current.error).toContain("Try again in 42s");
  });
});
