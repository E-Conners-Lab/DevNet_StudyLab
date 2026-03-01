import type { ChatMessage } from "@/hooks/use-chat";

export interface Conversation {
  id: string;
  title: string;
  domain: string | null;
  messages: ChatMessage[];
  timestamp: Date;
}
