import { NextRequest } from "next/server";
import { listExams } from "@/lib/data";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    const exams = listExams(domain ?? undefined);

    return jsonOk({ exams });
  } catch (error) {
    console.error("Error loading exams:", error);
    return jsonError("Failed to load exams");
  }
}
