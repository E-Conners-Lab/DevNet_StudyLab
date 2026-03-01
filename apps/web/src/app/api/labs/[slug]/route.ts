import { NextRequest } from "next/server";
import { getLab } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const lab = await getLab(slug);

    if (!lab) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    return jsonOk(lab);
  } catch (error) {
    console.error("Error loading lab:", error);
    return jsonError("Failed to load lab");
  }
}
