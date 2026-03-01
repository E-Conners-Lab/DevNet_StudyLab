import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import {
  getTutorConversation,
  updateTutorConversation,
  deleteTutorConversation,
} from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

/**
 * GET /api/tutor/conversations/[id]
 *
 * Returns a single conversation with all its messages.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const conversation = await getTutorConversation(userId, id);

    if (!conversation) {
      return jsonNotFound("Conversation");
    }

    return jsonOk({ conversation });
  } catch (error) {
    console.error("Error loading tutor conversation:", error);
    return jsonError("Failed to load conversation");
  }
}

/**
 * PATCH /api/tutor/conversations/[id]
 *
 * Updates conversation metadata (title).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return jsonOk({ success: false });
    }

    const body = await request.json();
    const { title } = body as { title?: string };

    await updateTutorConversation(userId, id, { title });
    return jsonOk({ success: true });
  } catch (error) {
    console.error("Error updating tutor conversation:", error);
    return jsonError("Failed to update conversation");
  }
}

/**
 * DELETE /api/tutor/conversations/[id]
 *
 * Deletes a conversation and all its messages.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return jsonOk({ success: false });
    }

    await deleteTutorConversation(userId, id);
    return jsonOk({ success: true });
  } catch (error) {
    console.error("Error deleting tutor conversation:", error);
    return jsonError("Failed to delete conversation");
  }
}
