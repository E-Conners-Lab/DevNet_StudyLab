"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  DEVNET_DOMAINS,
  getDomainBySlug,
  domainSlugToNumber,
  domainNumberToSlug,
} from "@/lib/domains";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatMessage } from "@/components/tutor/chat-message";
import { TypingIndicator } from "@/components/tutor/typing-indicator";
import { TutorSidebar } from "@/components/tutor/tutor-sidebar";
import { QuickPrompts } from "@/components/tutor/quick-prompts";
import { ChatInput } from "@/components/tutor/chat-input";
import type { Conversation } from "@/components/tutor/types";
import { useChat, type ChatMessage as ChatMessageType } from "@/hooks/use-chat";
import {
  ChevronDown,
  MessageSquare,
  Bot,
  Sparkles,
  X,
} from "lucide-react";

// ---------- Helpers ----------

function generateConversationTitle(messages: ChatMessageType[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Conversation";
  const text = firstUserMsg.content;
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
}

// ---------- Persistence helpers (fire-and-forget) ----------

async function apiCreateConversation(
  title: string,
  domainSlug: string | null,
): Promise<string | null> {
  try {
    const res = await fetch("/api/tutor/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, domainId: domainSlugToNumber(domainSlug) }),
    });
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

async function apiSaveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  try {
    await fetch(`/api/tutor/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    });
  } catch {
    // silent
  }
}

async function apiDeleteConversation(id: string): Promise<void> {
  try {
    await fetch(`/api/tutor/conversations/${id}`, { method: "DELETE" });
  } catch {
    // silent
  }
}

async function apiUpdateTitle(id: string, title: string): Promise<void> {
  try {
    await fetch(`/api/tutor/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  } catch {
    // silent
  }
}

// ---------- Page component ----------

export default function TutorPage() {
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat hook
  const { messages, isLoading, error, sendMessage, clearMessages, restoreMessages } = useChat({
    domain: selectedDomain || undefined,
  });

  // Input state
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Track the conversation ID that a pending message-save should target.
  const pendingConvIdRef = useRef<string | null>(null);

  // Load conversations from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tutor/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const loaded: Conversation[] = (data.conversations ?? []).map(
          (c: { id: string; title: string | null; domainId: number | null; updatedAt: string }) => ({
            id: c.id,
            title: c.title ?? "Untitled",
            domain: domainNumberToSlug(c.domainId),
            messages: [] as ChatMessageType[],
            timestamp: new Date(c.updatedAt),
          }),
        );
        setConversations(loaded);
      } catch {
        // DB not available — that's fine, start with empty
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync messages to active conversation
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      const title = generateConversationTitle(messages);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages, title, domain: selectedDomain, timestamp: new Date() }
            : c
        )
      );
    }
  }, [messages, activeConversationId, selectedDomain]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    let convId = activeConversationId;
    const title = trimmed.length > 50 ? trimmed.slice(0, 50) + "..." : trimmed;

    if (!convId) {
      const tempId = `temp-${Date.now()}`;
      const newConv: Conversation = {
        id: tempId,
        title,
        domain: selectedDomain,
        messages: [],
        timestamp: new Date(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(tempId);
      convId = tempId;

      apiCreateConversation(title, selectedDomain).then((dbId) => {
        if (dbId) {
          pendingConvIdRef.current = dbId;
          setConversations((prev) =>
            prev.map((c) => (c.id === tempId ? { ...c, id: dbId } : c))
          );
          setActiveConversationId((prev) => (prev === tempId ? dbId : prev));
        }
      });
    }

    setInput("");

    const isFirstMessage = messages.length === 0;
    const assistantContent = await sendMessage(trimmed);

    const realConvId = pendingConvIdRef.current || convId;
    if (realConvId && !realConvId.startsWith("temp-")) {
      apiSaveMessage(realConvId, "user", trimmed);
      if (assistantContent) {
        apiSaveMessage(realConvId, "assistant", assistantContent);
      }
      if (isFirstMessage) {
        apiUpdateTitle(realConvId, title);
      }
    }

    pendingConvIdRef.current = null;
  }, [input, isLoading, activeConversationId, selectedDomain, sendMessage, messages.length]);

  // New chat
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveConversationId(null);
    setInput("");
    setSidebarOpen(false);
  }, [clearMessages]);

  // Switch conversation — load messages from DB
  const handleSelectConversation = useCallback(
    async (conv: Conversation) => {
      setSidebarOpen(false);
      setActiveConversationId(conv.id);
      setSelectedDomain(conv.domain);

      if (conv.messages.length > 0) {
        restoreMessages(conv.messages);
        return;
      }

      try {
        const res = await fetch(`/api/tutor/conversations/${conv.id}`);
        if (!res.ok) {
          clearMessages();
          return;
        }
        const data = await res.json();
        const dbMessages: ChatMessageType[] = (data.conversation?.messages ?? []).map(
          (m: { id: number; role: "user" | "assistant"; content: string; createdAt: string }) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
          }),
        );

        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, messages: dbMessages } : c))
        );

        restoreMessages(dbMessages);
      } catch {
        clearMessages();
      }
    },
    [clearMessages, restoreMessages]
  );

  // Delete conversation
  const handleDeleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        clearMessages();
        setActiveConversationId(null);
      }
      if (!id.startsWith("temp-")) {
        apiDeleteConversation(id);
      }
    },
    [activeConversationId, clearMessages]
  );

  // Quick prompt
  const handleQuickPrompt = useCallback(
    (prompt: string, domain: string) => {
      setSelectedDomain(domain);
      setInput(prompt);
    },
    []
  );

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const displayMessages =
    messages.length > 0
      ? messages
      : activeConversation?.messages || [];

  const filteredConversations = filterDomain
    ? conversations.filter((c) => c.domain === filterDomain)
    : conversations;

  const currentDomain = getDomainBySlug(selectedDomain);

  return (
    <div className="flex h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] max-w-7xl mx-auto gap-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {/* ===== LEFT SIDEBAR: Conversation History ===== */}
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-80 flex-col border-r border-zinc-800 bg-zinc-900/50">
        <TutorSidebar
          conversations={filteredConversations}
          activeConversationId={activeConversationId}
          filterDomain={filterDomain}
          onFilterDomain={setFilterDomain}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-80 flex flex-col bg-zinc-900 border-r border-zinc-800 animate-in slide-in-from-left">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-medium text-zinc-200">Conversations</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSidebarOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TutorSidebar
              conversations={filteredConversations}
              activeConversationId={activeConversationId}
              filterDomain={filterDomain}
              onFilterDomain={setFilterDomain}
              onNewChat={handleNewChat}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>
        </div>
      )}

      {/* ===== RIGHT PANEL: Chat Interface ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden text-zinc-400 hover:text-zinc-200"
              onClick={() => setSidebarOpen(true)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Bot className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-200">AI Tutor</h1>
                <p className="text-[11px] text-zinc-500">DevNet 200-901</p>
              </div>
            </div>
          </div>

          {/* Domain selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {currentDomain ? (
                  <>
                    <span className="text-emerald-400 font-mono text-xs">
                      D{currentDomain.number}
                    </span>
                    <span className="hidden sm:inline">{currentDomain.shortName}</span>
                    <span className="sm:hidden">Domain {currentDomain.number}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    <span>All Domains</span>
                  </>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 bg-zinc-900 border-zinc-700"
            >
              <DropdownMenuLabel className="text-zinc-400">
                Focus Domain
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                onClick={() => setSelectedDomain(null)}
                className={cn(
                  "cursor-pointer",
                  !selectedDomain && "bg-emerald-500/10 text-emerald-400"
                )}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                All Domains
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              {DEVNET_DOMAINS.map((d) => (
                <DropdownMenuItem
                  key={d.slug}
                  onClick={() => setSelectedDomain(d.slug)}
                  className={cn(
                    "cursor-pointer",
                    selectedDomain === d.slug &&
                      "bg-emerald-500/10 text-emerald-400"
                  )}
                >
                  <span className="text-emerald-400 font-mono text-xs mr-2 w-5">
                    D{d.number}
                  </span>
                  {d.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages area */}
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 overflow-hidden"
        >
          <div className="px-4 py-6 space-y-6">
            {displayMessages.length === 0 && !isLoading ? (
              <QuickPrompts onSelect={handleQuickPrompt} />
            ) : (
              <>
                {displayMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                  />
                ))}
                {isLoading &&
                  displayMessages[displayMessages.length - 1]?.role === "user" && (
                    <TypingIndicator />
                  )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Input area */}
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          currentDomain={currentDomain}
        />
      </div>
    </div>
  );
}
