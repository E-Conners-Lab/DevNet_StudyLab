import { NextRequest } from "next/server";
import { sm2 } from "@/lib/flashcards";
import type { FlashcardProgress } from "@/lib/flashcards";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { getFlashcardProgress, upsertFlashcardProgress } from "@/lib/data";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

/**
 * GET /api/flashcards/progress
 *
 * Returns the authenticated user's flashcard SM-2 progress from the
 * database, keyed by flashcardId. Returns an empty map when not
 * authenticated or when the database is unavailable.
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const progress = await getFlashcardProgress(userId);
    return jsonOk({ progress });
  } catch (error) {
    console.error("Error loading flashcard progress:", error);
    return jsonOk({ progress: {} });
  }
}

/**
 * POST /api/flashcards/progress
 *
 * Accepts { flashcardId, quality, currentProgress? } and returns the updated
 * progress calculated via the SM-2 algorithm. Also persists to the database
 * when a user is authenticated (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flashcardId, quality, currentProgress } = body as {
      flashcardId: string;
      quality: number;
      currentProgress?: FlashcardProgress | null;
    };

    if (!flashcardId || quality === undefined || quality === null) {
      return jsonBadRequest("flashcardId and quality are required");
    }

    if (quality < 0 || quality > 5) {
      return jsonBadRequest("quality must be between 0 and 5");
    }

    // Use existing progress or defaults for a new card
    const repetitions = currentProgress?.repetitions ?? 0;
    const ease = currentProgress?.ease ?? 2.5;
    const interval = currentProgress?.interval ?? 0;

    const result = sm2(quality, repetitions, ease, interval);

    const updatedProgress: FlashcardProgress = {
      flashcardId,
      repetitions: result.repetitions,
      ease: result.ease,
      interval: result.interval,
      nextReview: result.nextReview,
      lastReview: new Date().toISOString(),
      quality,
    };

    // Fire-and-forget: persist to DB if user is authenticated
    const userId = await getCurrentUserId();
    if (userId) {
      upsertFlashcardProgress(userId, {
        flashcardId,
        ease: result.ease,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReview: result.nextReview,
        lastReview: new Date().toISOString(),
      }).catch((err) =>
        console.warn("Background flashcard progress save failed:", err),
      );
    }

    return jsonOk({ progress: updatedProgress });
  } catch (error) {
    console.error("Error computing progress:", error);
    return jsonError("Failed to compute progress");
  }
}
