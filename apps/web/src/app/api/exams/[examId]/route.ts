import { NextRequest } from "next/server";
import { getExam } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const { examId } = await params;
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    const exam = getExam(examId, {
      domain: domain ?? undefined,
      stripAnswers: true,
    });

    if (!exam) {
      return jsonNotFound(`Exam "${examId}"`);
    }

    return jsonOk(exam);
  } catch (error) {
    console.error("Error loading exam:", error);
    return jsonError("Failed to load exam");
  }
}
