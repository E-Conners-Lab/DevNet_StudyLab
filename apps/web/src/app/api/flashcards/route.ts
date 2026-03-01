import { NextRequest } from "next/server";
import { getAllFlashcards } from "@/lib/data";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    const flashcards = await getAllFlashcards(domain ?? undefined);

    // Build per-domain counts from the full set
    const allCards = domain ? await getAllFlashcards() : flashcards;
    const byDomain: Record<string, number> = {};
    for (const card of allCards) {
      byDomain[card.domainSlug] = (byDomain[card.domainSlug] ?? 0) + 1;
    }

    return jsonOk({
      flashcards,
      total: flashcards.length,
      byDomain,
    });
  } catch (error) {
    console.error("Error loading flashcards:", error);
    return jsonError("Failed to load flashcards");
  }
}
