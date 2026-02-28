/**
 * Data Access Layer — Flashcards
 *
 * Queries the database first; falls back to file reads when
 * DATABASE_URL is not configured or the query fails.
 */

import { eq, asc } from "drizzle-orm";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  getAllFlashcards as getAllFlashcardsFile,
  getFlashcardsByDomain as getFlashcardsByDomainFile,
} from "@/lib/flashcards";
import type { Flashcard } from "@/lib/flashcards";

export type { Flashcard } from "@/lib/flashcards";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all flashcards, optionally filtered by domain slug.
 * Tries DB first, falls back to file reads.
 */
export async function getAllFlashcards(
  domainSlug?: string,
): Promise<Flashcard[]> {
  if (isDbConfigured()) {
    try {
      const dbCards = await queryFlashcardsFromDb(domainSlug);
      // If the DB returns results, use them. If the DB is connected
      // but has no flashcard data (partial/empty seed), fall through
      // to file-based loading so the app still works.
      if (dbCards.length > 0) return dbCards;
    } catch (err) {
      console.warn("DB flashcard query failed, falling back to files:", err);
    }
  }

  return domainSlug
    ? getFlashcardsByDomainFile(domainSlug)
    : getAllFlashcardsFile();
}

// ---------------------------------------------------------------------------
// Database path
// ---------------------------------------------------------------------------

async function queryFlashcardsFromDb(
  domainSlug?: string,
): Promise<Flashcard[]> {
  const db = getDb();

  const selectFields = {
    id: schema.flashcards.id,
    question: schema.flashcards.question,
    answer: schema.flashcards.answer,
    explanation: schema.flashcards.explanation,
    sourceUrl: schema.flashcards.sourceUrl,
    difficulty: schema.flashcards.difficulty,
    tags: schema.flashcards.tags,
    objectiveCode: schema.objectives.code,
    domainOrder: schema.domains.orderIndex,
    domainName: schema.domains.name,
    domainSlug: schema.domains.slug,
  };

  const baseQuery = db
    .select(selectFields)
    .from(schema.flashcards)
    .innerJoin(
      schema.objectives,
      eq(schema.flashcards.objectiveId, schema.objectives.id),
    )
    .innerJoin(
      schema.domains,
      eq(schema.objectives.domainId, schema.domains.id),
    )
    .orderBy(asc(schema.domains.orderIndex), asc(schema.flashcards.id));

  const rows = domainSlug
    ? await baseQuery.where(eq(schema.domains.slug, domainSlug))
    : await baseQuery;

  return rows.map((r) => ({
    id: r.id,
    domain: r.domainOrder,
    domainName: r.domainName,
    domainSlug: r.domainSlug,
    objectiveCode: r.objectiveCode,
    question: r.question,
    answer: r.answer,
    explanation: r.explanation ?? "",
    sourceUrl: r.sourceUrl ?? "",
    difficulty: r.difficulty,
    tags: (r.tags as string[]) ?? [],
  }));
}
