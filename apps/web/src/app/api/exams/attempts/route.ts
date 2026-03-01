import { getCurrentUserId } from "@/lib/auth-helpers";
import { getExamAttempts } from "@/lib/data";
import { jsonOk } from "@/lib/api-helpers";

/**
 * GET /api/exams/attempts
 *
 * Returns past exam attempts for the authenticated user (newest first).
 * Returns an empty array when not authenticated or DB is unavailable.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const attempts = await getExamAttempts(userId);
    return jsonOk({ attempts });
  } catch (error) {
    console.error("Error loading exam attempts:", error);
    return jsonOk({ attempts: [] });
  }
}
