import { NextRequest } from "next/server";
import { getLabSolution } from "@/lib/data";
import { getCurrentUserId, isAuthBypassed } from "@/lib/auth-helpers";
import {
  jsonOk,
  jsonNotFound,
  jsonError,
  jsonUnauthorized,
} from "@/lib/api-helpers";

/**
 * GET /api/labs/[slug]/solution
 *
 * Returns the worked solution for a lab. This is answer-key material, so it is
 * gated on a session rather than served like the rest of the lab content. When
 * auth is bypassed (E2E runs, or local single-user use with no database) there
 * is no account to check and the solution is served as before.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId && !isAuthBypassed()) {
      return jsonUnauthorized("Sign in to view the lab solution.");
    }

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
