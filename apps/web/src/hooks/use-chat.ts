"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseChatOptions {
  domain?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<string | null>;
  clearMessages: () => void;
  restoreMessages: (msgs: ChatMessage[]) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string): Promise<string | null> => {
      if (!content.trim() || isLoading) return null;

      setError(null);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Build the messages array for the API (all messages including new one)
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: userMessage.role, content: userMessage.content },
      ];

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            domain: options.domain,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          // The route always sends an { error } message on a failure status
          // (401 sign-in required, 429 rate limited, 400 validation), so prefer
          // it; the fallbacks only cover a response that carries no body.
          const errorMessage =
            errorData?.error ||
            (response.status === 401
              ? "Please sign in to use the AI tutor."
              : response.status === 429
                ? "Rate limit reached. Please wait a moment and try again."
                : `Request failed (${response.status})`);
          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("No response body received");
        }

        // Add the empty assistant message to the state
        setMessages((prev) => [...prev, assistantMessage]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Update the assistant message content with accumulated text
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: accumulated }
                : m
            )
          );
        }

        return accumulated;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);

        // Remove the empty assistant message if there was an error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMessage.id)
        );
        return null;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, options.domain]
  );

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const restoreMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    setError(null);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages, restoreMessages };
}
