"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ReviewComplete } from "@/components/flashcards/review-complete";
import { ReviewCard } from "@/components/flashcards/review-card";
import { CardBrowser } from "@/components/flashcards/card-browser";
import {
  Layers,
  CheckCircle2,
  Clock,
  Play,
  Brain,
  BookOpen,
} from "lucide-react";
import { useFlashcards } from "@/hooks/use-flashcards";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FlashcardsPage() {
  const {
    flashcards,
    dueCards,
    stats,
    isLoading,
    reviewCard,
    reviewQueue,
    reviewIndex,
    sessionStats,
    isReviewActive,
    isReviewComplete,
    reviewProgress,
    startReview,
    rateCard,
    nextCard,
    endReview,
    getCardProgress,
  } = useFlashcards();

  // UI state
  const [isFlipped, setIsFlipped] = useState(false);
  const [domainFilter, setDomainFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Reset flip when card changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFlipped(false);
  }, [reviewIndex]);

  // ---- Handlers ----
  const handleFlip = useCallback(() => {
    if (isReviewActive && !isReviewComplete) {
      setIsFlipped((prev) => !prev);
    }
  }, [isReviewActive, isReviewComplete]);

  const handleRate = useCallback(
    (quality: number) => {
      if (!reviewCard) return;
      rateCard(reviewCard.id, quality);
      setIsFlipped(false);
    },
    [reviewCard, rateCard]
  );

  const handleSkip = useCallback(() => {
    nextCard();
    setIsFlipped(false);
  }, [nextCard]);

  const handleStartReview = useCallback(() => {
    startReview(domainFilter !== "all" ? domainFilter : undefined);
  }, [startReview, domainFilter]);

  // ---- Keyboard shortcuts (only during review) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isReviewActive || isReviewComplete) return;

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleFlip();
      }

      if (isFlipped) {
        if (e.key === "1") { e.preventDefault(); handleRate(0); }
        if (e.key === "2") { e.preventDefault(); handleRate(2); }
        if (e.key === "3") { e.preventDefault(); handleRate(4); }
        if (e.key === "4") { e.preventDefault(); handleRate(5); }
        if (e.key === "s" || e.key === "S") { e.preventDefault(); handleSkip(); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReviewActive, isReviewComplete, isFlipped, handleFlip, handleRate, handleSkip]);

  // ---- Filtered cards for browse mode ----
  const browsableCards = useMemo(() => {
    let cards = flashcards;
    if (domainFilter !== "all") {
      cards = cards.filter((c) => c.domainSlug === domainFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.question.toLowerCase().includes(q) ||
          c.answer.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return [...cards].sort((a, b) => {
      if (a.domain !== b.domain) return a.domain - b.domain;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [flashcards, domainFilter, searchQuery]);

  // ---- Due cards count per domain ----
  const dueCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dueCards.length };
    for (const card of dueCards) {
      counts[card.domainSlug] = (counts[card.domainSlug] ?? 0) + 1;
    }
    return counts;
  }, [dueCards]);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-500">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  // ---- Review Complete Screen ----
  if (isReviewActive && isReviewComplete) {
    return (
      <ReviewComplete
        sessionStats={sessionStats}
        dueCardsCount={dueCards.length}
        onEndReview={endReview}
        onStartReview={handleStartReview}
      />
    );
  }

  // ---- Active Review Screen ----
  if (isReviewActive && reviewCard) {
    return (
      <ReviewCard
        card={reviewCard}
        cardProgress={getCardProgress(reviewCard.id)}
        reviewIndex={reviewIndex}
        queueLength={reviewQueue.length}
        reviewProgress={reviewProgress}
        isFlipped={isFlipped}
        showShortcuts={showShortcuts}
        onFlip={handleFlip}
        onRate={handleRate}
        onSkip={handleSkip}
        onEndReview={endReview}
        onToggleShortcuts={() => setShowShortcuts((v) => !v)}
      />
    );
  }

  // ---- Browse / Default Screen ----
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Flashcards
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            SM-2 spaced repetition to master DevNet concepts &mdash;{" "}
            <span className="text-emerald-400 font-medium">{stats.total}</span>{" "}
            cards across 6 domains
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard icon={Layers} label="Total Cards" value={stats.total} />
        <StatsCard
          icon={Clock}
          label="Due Today"
          value={stats.dueToday}
          trend={
            stats.dueToday > 0
              ? { value: `${stats.dueToday} to review`, positive: false }
              : undefined
          }
        />
        <StatsCard
          icon={CheckCircle2}
          label="Mastered"
          value={stats.mastered}
          trend={
            stats.total > 0
              ? {
                  value: `${Math.round((stats.mastered / stats.total) * 100)}%`,
                  positive: true,
                }
              : undefined
          }
        />
        <StatsCard
          icon={BookOpen}
          label="Learning"
          value={stats.learning}
        />
      </div>

      {/* Progress Breakdown Bar */}
      {stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span>
              {stats.mastered} mastered / {stats.learning} learning / {stats.newCards} new
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(stats.mastered / stats.total) * 100}%` }}
            />
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${(stats.learning / stats.total) * 100}%` }}
            />
            <div
              className="bg-blue-500/40 transition-all duration-500"
              style={{ width: `${(stats.newCards / stats.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Mastered
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Learning
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500/40" /> New
            </span>
          </div>
        </div>
      )}

      {/* Start Review CTA */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 mb-4">
            <Brain className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-200 mb-2">
            Ready to Review?
          </h2>
          <p className="text-sm text-zinc-500 mb-6 text-center max-w-md">
            You have{" "}
            <span className="text-emerald-400 font-semibold">
              {stats.dueToday}
            </span>{" "}
            cards due for review. Spaced repetition helps you retain information
            more effectively by reviewing cards at optimal intervals.
          </p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8"
            onClick={handleStartReview}
            disabled={stats.dueToday === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Review ({stats.dueToday} cards)
          </Button>
          {stats.dueToday === 0 && stats.total > 0 && (
            <p className="text-xs text-zinc-600 mt-3">
              All caught up! Check back later for more reviews.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Browse Section */}
      <CardBrowser
        cards={browsableCards}
        dueCounts={dueCounts}
        domainFilter={domainFilter}
        onDomainFilterChange={setDomainFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        expandedCard={expandedCard}
        onExpandedCardChange={setExpandedCard}
        getCardProgress={getCardProgress}
      />
    </div>
  );
}
