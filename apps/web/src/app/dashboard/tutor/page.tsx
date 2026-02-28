"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatMessage } from "@/components/tutor/chat-message";
import { TypingIndicator } from "@/components/tutor/typing-indicator";
import { useChat, type ChatMessage as ChatMessageType } from "@/hooks/use-chat";
import {
  Plus,
  Send,
  ChevronDown,
  MessageSquare,
  Bot,
  Sparkles,
  Trash2,
  Clock,
  Search,
  X,
} from "lucide-react";

// ---------- Domain data ----------

interface Domain {
  slug: string;
  shortName: string;
  fullName: string;
  number: number;
}

const domains: Domain[] = [
  { slug: "software-dev", shortName: "Software Dev", fullName: "Software Development & Design", number: 1 },
  { slug: "apis", shortName: "APIs", fullName: "Understanding & Using APIs", number: 2 },
  { slug: "cisco-platforms", shortName: "Cisco Platforms", fullName: "Cisco Platforms & Development", number: 3 },
  { slug: "deployment-security", shortName: "Deployment", fullName: "Application Deployment & Security", number: 4 },
  { slug: "infrastructure-automation", shortName: "Infrastructure", fullName: "Infrastructure & Automation", number: 5 },
  { slug: "network-fundamentals", shortName: "Networking", fullName: "Network Fundamentals", number: 6 },
];

// ---------- Quick prompts ----------

const quickPrompts = [
  {
    text: "Explain REST API authentication methods",
    domain: "apis",
  },
  {
    text: "What's the difference between NETCONF and RESTCONF?",
    domain: "infrastructure-automation",
  },
  {
    text: "Help me understand Docker containers vs VMs",
    domain: "deployment-security",
  },
  {
    text: "Quiz me on Cisco Meraki API endpoints",
    domain: "cisco-platforms",
  },
  {
    text: "Explain the MVC design pattern with a Python example",
    domain: "software-dev",
  },
  {
    text: "What are the key OWASP threats I need to know?",
    domain: "deployment-security",
  },
];

// ---------- Conversation history type ----------

interface Conversation {
  id: string;
  title: string;
  domain: string | null;
  messages: ChatMessageType[];
  timestamp: Date;
}

// ---------- Helper ----------

function getDomainBySlug(slug: string | null): Domain | undefined {
  if (!slug) return undefined;
  return domains.find((d) => d.slug === slug);
}

function generateConversationTitle(messages: ChatMessageType[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Conversation";
  const text = firstUserMsg.content;
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
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
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat({
    domain: selectedDomain || undefined,
  });

  // Input state
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 5 * 24; // ~5 lines
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync messages to active conversation. setState in an effect is
  // intentional here — conversations must stay in sync with the chat
  // hook's message state which is the source of truth.
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                messages,
                title: generateConversationTitle(messages),
                domain: selectedDomain,
                timestamp: new Date(),
              }
            : c
        )
      );
    }
  }, [messages, activeConversationId, selectedDomain]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // If no active conversation, create one
    if (!activeConversationId) {
      const newId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        title: trimmed.length > 50 ? trimmed.slice(0, 50) + "..." : trimmed,
        domain: selectedDomain,
        messages: [],
        timestamp: new Date(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newId);
    }

    setInput("");
    await sendMessage(trimmed);
  }, [input, isLoading, activeConversationId, selectedDomain, sendMessage]);

  // Handle keyboard
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // New chat
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveConversationId(null);
    setInput("");
    setSidebarOpen(false);
  }, [clearMessages]);

  // Switch conversation
  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      clearMessages();
      setActiveConversationId(conv.id);
      setSelectedDomain(conv.domain);
      // Restore messages by re-sending them to the hook would be complex;
      // instead, we store them and display from conversation state
      setSidebarOpen(false);
    },
    [clearMessages]
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
    },
    [activeConversationId, clearMessages]
  );

  // Quick prompt
  const handleQuickPrompt = useCallback(
    (prompt: string, domain: string) => {
      setSelectedDomain(domain);
      setInput(prompt);
      // Focus the textarea so user can just hit enter or edit
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    []
  );

  // Get display messages: if we have an active conversation with stored messages and
  // the hook messages are empty, show stored ones
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const displayMessages =
    messages.length > 0
      ? messages
      : activeConversation?.messages || [];

  // Filtered conversations
  const filteredConversations = filterDomain
    ? conversations.filter((c) => c.domain === filterDomain)
    : conversations;

  const currentDomain = getDomainBySlug(selectedDomain);

  return (
    <div className="flex h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] max-w-7xl mx-auto gap-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {/* ===== LEFT SIDEBAR: Conversation History ===== */}
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-80 flex-col border-r border-zinc-800 bg-zinc-900/50">
        <SidebarContent
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
            <SidebarContent
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
              {domains.map((d) => (
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
                  {d.fullName}
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
              /* Empty state: Quick prompts */
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-8">
                <div className="text-center space-y-3">
                  <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-500/10">
                    <Bot className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-200">
                    DevNet AI Tutor
                  </h2>
                  <p className="text-sm text-zinc-500 max-w-md">
                    Ask me anything about the Cisco DevNet Associate 200-901 exam.
                    I can explain concepts, provide code examples, and quiz you.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                  {quickPrompts.map((prompt, i) => {
                    const domain = getDomainBySlug(prompt.domain);
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          handleQuickPrompt(prompt.text, prompt.domain)
                        }
                        className="group flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-all hover:border-emerald-500/30 hover:bg-zinc-800/50"
                      >
                        <span className="text-sm text-zinc-300 group-hover:text-zinc-100 leading-snug">
                          {prompt.text}
                        </span>
                        {domain && (
                          <Badge
                            variant="secondary"
                            className="w-fit bg-zinc-800 text-zinc-500 text-[10px] group-hover:bg-emerald-500/10 group-hover:text-emerald-400"
                          >
                            D{domain.number} {domain.shortName}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
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
        <div className="border-t border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex items-end gap-3 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              {currentDomain && (
                <div className="absolute left-3 top-2">
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] py-0"
                  >
                    D{currentDomain.number}
                  </Badge>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about DevNet topics..."
                rows={1}
                className={cn(
                  "w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-100 placeholder:text-zinc-500",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50",
                  "px-4 py-3 leading-6 max-h-[120px] overflow-y-auto",
                  currentDomain && "pt-8"
                )}
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className={cn(
                      "shrink-0 rounded-xl transition-all",
                      input.trim() && !isLoading
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message (Enter)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[11px] text-zinc-600 text-center mt-2">
            Enter to send &middot; Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Sidebar content (shared between desktop and mobile) ----------

interface SidebarContentProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  filterDomain: string | null;
  onFilterDomain: (domain: string | null) => void;
  onNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
}

function SidebarContent({
  conversations,
  activeConversationId,
  filterDomain,
  onFilterDomain,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: SidebarContentProps) {
  return (
    <>
      {/* New Chat button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Domain filter */}
      <div className="px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                {filterDomain
                  ? getDomainBySlug(filterDomain)?.shortName || "Filter"
                  : "All Domains"}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 bg-zinc-900 border-zinc-700"
          >
            <DropdownMenuItem
              onClick={() => onFilterDomain(null)}
              className={cn(
                "cursor-pointer",
                !filterDomain && "bg-emerald-500/10 text-emerald-400"
              )}
            >
              All Domains
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-700" />
            {domains.map((d) => (
              <DropdownMenuItem
                key={d.slug}
                onClick={() => onFilterDomain(d.slug)}
                className={cn(
                  "cursor-pointer",
                  filterDomain === d.slug &&
                    "bg-emerald-500/10 text-emerald-400"
                )}
              >
                <span className="text-emerald-400 font-mono text-xs mr-2">
                  D{d.number}
                </span>
                {d.shortName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">No conversations yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Start a new chat to begin studying
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const domain = getDomainBySlug(conv.domain);
              const isActive = conv.id === activeConversationId;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={cn(
                    "group w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {domain && (
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-500 text-[10px] py-0 px-1.5"
                        >
                          D{domain.number}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimestamp(conv.timestamp)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => onDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-zinc-700/50 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" />
                  </button>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ---------- Timestamp formatting ----------

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
