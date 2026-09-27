"use client";

import { localFetch as fetch } from "@/lib/local/client";
import { rateFlashcard, getStudySnapshot } from "@/lib/local/store";

import { useState, useEffect, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types (client-safe — no fs imports)
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
  nextReview: string;
  lastReview: string;
  quality: number;
}

export interface FlashcardStats {
  total: number;
  dueToday: number;
  mastered: number;   // interval > 21 days
  learning: number;   // reviewed but interval <= 21
  newCards: number;    // never reviewed
}

export interface ReviewSessionStats {
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  averageQuality: number;
  nextReviewTime: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFlashcards() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<Record<string, FlashcardProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review session state
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState<ReviewSessionStats>({
    cardsReviewed: 0,
    correctCount: 0,
    incorrectCount: 0,
    averageQuality: 0,
    nextReviewTime: null,
  });

  // ---- Load flashcards from API ----
  useEffect(() => {
    async function fetchCards() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/flashcards");
        if (!res.ok) throw new Error("Failed to fetch flashcards");
        const data = await res.json();
        setFlashcards(data.flashcards ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchCards();
  }, []);

  useEffect(() => { setProgress(getStudySnapshot().state.flashcards); }, []);

  // ---- Derived: cards due for review ----
  const dueCards = useMemo(() => {
    const now = new Date();
    return flashcards.filter((card) => {
      const p = progress[card.id];
      if (!p) return true; // never reviewed
      return new Date(p.nextReview) <= now;
    });
  }, [flashcards, progress]);

  // ---- Stats ----
  const stats: FlashcardStats = useMemo(() => {
    let mastered = 0;
    let learning = 0;
    let newCards = 0;

    for (const card of flashcards) {
      const p = progress[card.id];
      if (!p) {
        newCards++;
      } else if (p.interval > 21) {
        mastered++;
      } else {
        learning++;
      }
    }

    return {
      total: flashcards.length,
      dueToday: dueCards.length,
      mastered,
      learning,
      newCards,
    };
  }, [flashcards, progress, dueCards]);

  // ---- Current review card ----
  const reviewCard: Flashcard | null = useMemo(() => {
    if (reviewQueue.length === 0) return null;
    return reviewQueue[reviewIndex] ?? null;
  }, [reviewQueue, reviewIndex]);

  // ---- Start a review session ----
  const startReview = useCallback(
    (domain?: string) => {
      const now = new Date();
      let eligible = flashcards.filter((card) => {
        const p = progress[card.id];
        if (!p) return true;
        return new Date(p.nextReview) <= now;
      });
      if (domain && domain !== "all") {
        eligible = eligible.filter((c) => c.domainSlug === domain);
      }
      // Shuffle for variety
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      setReviewQueue(shuffled);
      setReviewIndex(0);
      setSessionStats({
        cardsReviewed: 0,
        correctCount: 0,
        incorrectCount: 0,
        averageQuality: 0,
        nextReviewTime: null,
      });
    },
    [flashcards, progress]
  );

  // ---- Rate the current card ----
  const rateCard = useCallback(
    (id: string, quality: number) => {
      let updatedProgress: FlashcardProgress;
      try { updatedProgress = rateFlashcard(id, quality); }
      catch (err) { setError(err instanceof Error ? err.message : "Progress could not be saved. Export a backup before closing."); return; }
      const result = updatedProgress;
      const newProgress = { ...progress, [id]: updatedProgress };

      // Enqueue ALL state updates first (these always succeed)
      setProgress(newProgress);
      setSessionStats((prev) => {
        const reviewed = prev.cardsReviewed + 1;
        const correct = quality >= 3 ? prev.correctCount + 1 : prev.correctCount;
        const incorrect = quality < 3 ? prev.incorrectCount + 1 : prev.incorrectCount;
        const totalQ = prev.averageQuality * prev.cardsReviewed + quality;

        // Find earliest next review among all rated cards this session
        let earliest = prev.nextReviewTime;
        if (!earliest || result.nextReview < earliest) {
          earliest = result.nextReview;
        }

        return {
          cardsReviewed: reviewed,
          correctCount: correct,
          incorrectCount: incorrect,
          averageQuality: reviewed > 0 ? totalQ / reviewed : 0,
          nextReviewTime: earliest,
        };
      });
      setReviewIndex((prev) => prev + 1);


    },
    [progress]
  );

  // ---- Navigate review ----
  const nextCard = useCallback(() => {
    setReviewIndex((prev) => Math.min(prev + 1, reviewQueue.length));
  }, [reviewQueue.length]);

  const prevCard = useCallback(() => {
    setReviewIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // ---- End review session ----
  const endReview = useCallback(() => {
    setReviewQueue([]);
    setReviewIndex(0);
  }, []);

  // ---- Get progress for a specific card ----
  const getCardProgress = useCallback(
    (cardId: string): FlashcardProgress | null => {
      return progress[cardId] ?? null;
    },
    [progress]
  );

  // ---- Review session helpers ----
  const isReviewActive = reviewQueue.length > 0;
  const isReviewComplete = isReviewActive && reviewIndex >= reviewQueue.length;
  const reviewProgress = reviewQueue.length > 0
    ? Math.round((Math.min(reviewIndex, reviewQueue.length) / reviewQueue.length) * 100)
    : 0;

  return {
    // Data
    flashcards,
    dueCards,
    progress,
    stats,
    isLoading,
    error,

    // Review session
    reviewCard,
    reviewQueue,
    reviewIndex,
    sessionStats,
    isReviewActive,
    isReviewComplete,
    reviewProgress,

    // Actions
    startReview,
    rateCard,
    nextCard,
    prevCard,
    endReview,
    getCardProgress,
  };
}
