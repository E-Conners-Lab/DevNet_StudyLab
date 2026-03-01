import { NextRequest } from "next/server";
import { gradeExam, saveExamAttempt } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { jsonOk, jsonBadRequest, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const { examId } = await params;

    // Extract optional domain filter from query params
    const domainFilter = request.nextUrl.searchParams.get("domain") ?? undefined;

    // Parse and validate request body
    let body: { answers: Record<string, string | string[]>; timeTaken?: number };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON in request body");
    }

    const { answers, timeTaken } = body;

    if (!answers || typeof answers !== "object") {
      return jsonBadRequest('"answers" object is required');
    }

    // Default timeTaken to 0 if not provided
    const resolvedTimeTaken = typeof timeTaken === "number" ? timeTaken : 0;

    const result = gradeExam(examId, answers, resolvedTimeTaken, domainFilter);

    if (!result) {
      return jsonNotFound(`Exam "${examId}"`);
    }

    // Fire-and-forget: persist the attempt to DB if user is authenticated
    const userId = await getCurrentUserId();
    if (userId && result.questionResults) {
      saveExamAttempt(userId, {
        score: result.score,
        totalQuestions: result.totalQuestions,
        domainFilter,
        timeTakenSeconds: resolvedTimeTaken,
        answers: result.questionResults.map((q) => ({
          questionId: q.questionId,
          userAnswer: q.userAnswer,
          isCorrect: q.correct,
        })),
      }).catch((err) =>
        console.warn("Background exam attempt save failed:", err),
      );
    }

    return jsonOk(result);
  } catch (error) {
    console.error("Error grading exam:", error);
    return jsonError("Failed to grade exam");
  }
}
