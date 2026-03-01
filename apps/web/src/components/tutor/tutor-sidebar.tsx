import { cn } from "@/lib/utils";
import { DEVNET_DOMAINS, getDomainBySlug } from "@/lib/domains";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ChevronDown,
  MessageSquare,
  Trash2,
  Clock,
  Search,
} from "lucide-react";
import type { Conversation } from "./types";

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

// ---------- Component ----------

interface TutorSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  filterDomain: string | null;
  onFilterDomain: (domain: string | null) => void;
  onNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
}

export function TutorSidebar({
  conversations,
  activeConversationId,
  filterDomain,
  onFilterDomain,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: TutorSidebarProps) {
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
            {DEVNET_DOMAINS.map((d) => (
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
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(conv)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectConversation(conv);
                    }
                  }}
                  className={cn(
                    "group w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer",
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
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
}
