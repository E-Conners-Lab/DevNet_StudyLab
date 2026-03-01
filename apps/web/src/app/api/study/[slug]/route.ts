import { NextRequest } from "next/server";
import { getStudyGuide } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const guide = getStudyGuide(slug);

    if (!guide) {
      return jsonNotFound(`Study guide "${slug}"`);
    }

    return jsonOk(guide);
  } catch (error) {
    console.error("Error loading study guide:", error);
    return jsonError("Failed to load study guide");
  }
}
