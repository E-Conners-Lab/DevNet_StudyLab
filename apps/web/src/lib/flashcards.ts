import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Flashcard {
  id: string;
  domain: number;
  domainName: string;
  domainSlug: string;
  objectiveCode: string;
  question: string;
  answer: string;
  explanation: string;
  sourceUrl: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface FlashcardProgress {
  flashcardId: string;
  repetitions: number;
  ease: number;
  interval: number;
  nextReview: string; // ISO date string
  lastReview: string; // ISO date string
  quality: number; // last quality rating
}

export interface SM2Result {
  repetitions: number;
  ease: number;
  interval: number;
  nextReview: string; // ISO date string
}

// ---------------------------------------------------------------------------
// SM-2 Algorithm
// ---------------------------------------------------------------------------

/**
 * SuperMemo SM-2 spaced repetition algorithm.
 *
 * @param quality     - Rating 0-5 (0=blackout, 1=wrong, 2=wrong but close,
 *                      3=correct with difficulty, 4=correct, 5=perfect)
 * @param repetitions - Number of consecutive correct repetitions so far
 * @param ease        - Easiness factor (>= 1.3, default 2.5)
 * @param interval    - Current interval in days
 * @returns Updated { repetitions, ease, interval, nextReview }
 */
export function sm2(
  quality: number,
  repetitions: number,
  ease: number,
  interval: number
): SM2Result {
  // Clamp quality to 0-5
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let newRepetitions = repetitions;
  let newEase = ease;
  let newInterval = interval;

  if (q >= 3) {
    // Correct response
    if (newRepetitions === 0) {
      newInterval = 1;
    } else if (newRepetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * ease);
    }
    newRepetitions += 1;
  } else {
    // Incorrect response — reset
    newRepetitions = 0;
    newInterval = 1;
  }

  // Adjust ease factor
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  newEase = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  // Ease factor must not drop below 1.3
  if (newEase < 1.3) {
    newEase = 1.3;
  }

  // Round ease to 2 decimals
  newEase = Math.round(newEase * 100) / 100;

  // Calculate next review date
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    repetitions: newRepetitions,
    ease: newEase,
    interval: newInterval,
    nextReview: nextReview.toISOString(),
  };
}

import { NUMBER_TO_SLUG } from "@/lib/domains";

// ---------------------------------------------------------------------------
// File loading utilities (server-side only)
// ---------------------------------------------------------------------------

interface RawFlashcardFile {
  domain: number;
  domainName: string;
  flashcards: {
    id: string;
    objectiveCode: string;
    question: string;
    answer: string;
    explanation: string;
    sourceUrl: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
  }[];
}

function getFlashcardsDir(): string {
  // content/flashcards/ is at the monorepo root
  // apps/web/ is two levels deep from root
  return path.join(process.cwd(), "..", "..", "content", "flashcards");
}

function loadFlashcardFile(filePath: string): Flashcard[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: RawFlashcardFile = JSON.parse(raw);
  const slug = NUMBER_TO_SLUG[data.domain] ?? `domain-${data.domain}`;

  return data.flashcards.map((fc) => ({
    id: fc.id,
    domain: data.domain,
    domainName: data.domainName,
    domainSlug: slug,
    objectiveCode: fc.objectiveCode,
    question: fc.question,
    answer: fc.answer,
    explanation: fc.explanation,
    sourceUrl: fc.sourceUrl,
    difficulty: fc.difficulty,
    tags: fc.tags,
  }));
}

// Module-level cache (safe — flashcard JSON is static at runtime)
let flashcardCache: Flashcard[] | null = null;

/**
 * Returns all flashcards from every domain file.
 */
export function getAllFlashcards(): Flashcard[] {
  if (flashcardCache) return flashcardCache;

  const dir = getFlashcardsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("domain-") && f.endsWith(".json"))
    .sort();

  const all: Flashcard[] = [];
  for (const file of files) {
    all.push(...loadFlashcardFile(path.join(dir, file)));
  }
  flashcardCache = all;
  return all;
}

/**
 * Returns flashcards filtered by domain slug.
 */
export function getFlashcardsByDomain(domainSlug: string): Flashcard[] {
  const all = getAllFlashcards();
  return all.filter((fc) => fc.domainSlug === domainSlug);
}
