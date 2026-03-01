import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import {
  getTutorConversations,
  createTutorConversation,
} from "@/lib/data";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

/**
 * GET /api/tutor/conversations
 *
 * Returns all tutor conversations for the authenticated user.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const conversations = await getTutorConversations(userId);
    return jsonOk({ conversations });
  } catch (error) {
    console.error("Error loading tutor conversations:", error);
    return jsonOk({ conversations: [] });
  }
}

/**
 * POST /api/tutor/conversations
 *
 * Creates a new tutor conversation. Returns { id } of the new conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return jsonOk({ id: null });
    }

    const body = await request.json();
    const { title, domainId } = body as {
      title: string;
      domainId: number | null;
    };

    if (!title || typeof title !== "string") {
      return jsonBadRequest("title is required");
    }

    const id = await createTutorConversation(userId, {
      title,
      domainId: domainId ?? null,
    });

    return jsonOk({ id });
  } catch (error) {
    console.error("Error creating tutor conversation:", error);
    return jsonError("Failed to create conversation");
  }
}
