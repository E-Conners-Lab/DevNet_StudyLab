import { NextRequest } from "next/server";
import { getLabSolution } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const solution = getLabSolution(slug);

    if (!solution) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    return jsonOk(solution);
  } catch (error) {
    console.error("Error loading lab solution:", error);
    return jsonError("Failed to load lab solution");
  }
}
