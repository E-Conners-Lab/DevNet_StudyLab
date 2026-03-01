import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { saveTutorMessage } from "@/lib/data";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

/**
 * POST /api/tutor/conversations/[id]/messages
 *
 * Saves a message to a conversation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return jsonOk({ id: null });
    }

    const body = await request.json();
    const { role, content } = body as {
      role: "user" | "assistant";
      content: string;
    };

    if (!role || !content) {
      return jsonBadRequest("role and content are required");
    }

    if (role !== "user" && role !== "assistant") {
      return jsonBadRequest("role must be 'user' or 'assistant'");
    }

    const messageId = await saveTutorMessage(userId, id, { role, content });
    return jsonOk({ id: messageId });
  } catch (error) {
    console.error("Error saving tutor message:", error);
    return jsonError("Failed to save message");
  }
}
