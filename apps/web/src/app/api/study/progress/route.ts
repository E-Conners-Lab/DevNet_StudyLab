import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { getStudyProgress, saveStudyObjective } from "@/lib/data";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

/**
 * GET /api/study/progress
 *
 * Returns an array of completed objective codes (e.g. ["1.1", "2.3"])
 * for the authenticated user. Returns empty array when not authenticated.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const completed = await getStudyProgress(userId);
    return jsonOk({ completed });
  } catch (error) {
    console.error("Error loading study progress:", error);
    return jsonOk({ completed: [] });
  }
}

/**
 * POST /api/study/progress
 *
 * Toggle an objective's completion status.
 * Body: { objectiveCode: "1.1", completed: true }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      // No user — silently succeed (client-side state still works)
      return jsonOk({ ok: true });
    }

    const body = await request.json();
    const { objectiveCode, completed } = body as {
      objectiveCode: string;
      completed: boolean;
    };

    if (!objectiveCode || typeof completed !== "boolean") {
      return jsonBadRequest("objectiveCode (string) and completed (boolean) are required");
    }

    await saveStudyObjective(userId, objectiveCode, completed);
    return jsonOk({ ok: true });
  } catch (error) {
    console.error("Error saving study progress:", error);
    return jsonError("Failed to save study progress");
  }
}
