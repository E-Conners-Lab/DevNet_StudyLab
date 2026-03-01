import { useRef, useEffect, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send } from "lucide-react";
import type { DevNetDomain } from "@/lib/domains";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  currentDomain: DevNetDomain | undefined;
}

export function ChatInput({
  input,
  onInputChange,
  onSend,
  isLoading,
  currentDomain,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 5 * 24; // ~5 lines
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
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
            onChange={(e) => onInputChange(e.target.value)}
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
                onClick={onSend}
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
  );
}
