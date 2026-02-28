"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatsCard } from "@/components/dashboard/stats-card";
import {
  Layers,
  RotateCcw,
  CheckCircle2,
  Clock,
  Play,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Brain,
  Search,
  BookOpen,
  Trophy,
  ExternalLink,
  Keyboard,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlashcards } from "@/hooks/use-flashcards";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SM2Rating = "again" | "hard" | "good" | "easy";

const RATING_CONFIG: Record<
  SM2Rating,
  { label: string; quality: number; color: string; shortcut: string; description: string }
> = {
  again: {
    label: "Again",
    quality: 0,
    color: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
    shortcut: "1",
    description: "< 1 day",
  },
  hard: {
    label: "Hard",
    quality: 2,
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
    shortcut: "2",
    description: "~1 day",
  },
  good: {
    label: "Good",
    quality: 4,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
    shortcut: "3",
    description: "~3 days",
  },
  easy: {
    label: "Easy",
    quality: 5,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
    shortcut: "4",
    description: "~7 days",
  },
};

const DOMAIN_TABS = [
  { slug: "all", label: "All Domains", short: "All" },
  { slug: "software-development-design", label: "1. Software Dev & Design", short: "D1" },
  { slug: "understanding-using-apis", label: "2. APIs", short: "D2" },
  { slug: "cisco-platforms-development", label: "3. Cisco Platforms", short: "D3" },
  { slug: "application-deployment-security", label: "4. App Deploy & Security", short: "D4" },
  { slug: "infrastructure-automation", label: "5. Infrastructure & Auto", short: "D5" },
  { slug: "network-fundamentals", label: "6. Network Fundamentals", short: "D6" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDifficultyBadge(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "medium":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "hard":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}

function getStatusBadge(interval: number | undefined, hasProgress: boolean) {
  if (!hasProgress) return { label: "New", className: "bg-blue-500/10 text-blue-400" };
  if (interval !== undefined && interval > 21) return { label: "Mastered", className: "bg-emerald-500/10 text-emerald-400" };
  return { label: "Learning", className: "bg-amber-500/10 text-amber-400" };
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
  return `In ${Math.ceil(diffDays / 30)} months`;
}

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

  // ---- Flip handler ----
  const handleFlip = useCallback(() => {
    if (isReviewActive && !isReviewComplete) {
      setIsFlipped((prev) => !prev);
    }
  }, [isReviewActive, isReviewComplete]);

  // ---- Rate handler ----
  const handleRate = useCallback(
    (rating: SM2Rating) => {
      if (!reviewCard) return;
      const quality = RATING_CONFIG[rating].quality;
      rateCard(reviewCard.id, quality);
      setIsFlipped(false);
    },
    [reviewCard, rateCard]
  );

  // ---- Start review ----
  const handleStartReview = useCallback(() => {
    startReview(domainFilter !== "all" ? domainFilter : undefined);
  }, [startReview, domainFilter]);

  // ---- Keyboard shortcuts (only during review) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts during active review
      if (!isReviewActive || isReviewComplete) return;

      // Don't capture when typing in search
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleFlip();
      }

      if (isFlipped) {
        if (e.key === "1") { e.preventDefault(); handleRate("again"); }
        if (e.key === "2") { e.preventDefault(); handleRate("hard"); }
        if (e.key === "3") { e.preventDefault(); handleRate("good"); }
        if (e.key === "4") { e.preventDefault(); handleRate("easy"); }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReviewActive, isReviewComplete, isFlipped, handleFlip, handleRate]);

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
    return cards;
  }, [flashcards, domainFilter, searchQuery]);

  // ---- Due cards count per domain for the filter ----
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
    const accuracy =
      sessionStats.cardsReviewed > 0
        ? Math.round(
            (sessionStats.correctCount / sessionStats.cardsReviewed) * 100
          )
        : 0;

    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 mb-6">
              <Trophy className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              Session Complete!
            </h2>
            <p className="text-sm text-zinc-500 mb-8 text-center max-w-md">
              Great work reinforcing your DevNet knowledge.
            </p>

            {/* Session Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-lg mb-8">
              <div className="text-center p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-2xl font-bold text-zinc-100">
                  {sessionStats.cardsReviewed}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Cards Reviewed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-2xl font-bold text-emerald-400">
                  {accuracy}%
                </p>
                <p className="text-xs text-zinc-500 mt-1">Accuracy</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-2xl font-bold text-blue-400">
                  {sessionStats.correctCount}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Correct</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-2xl font-bold text-red-400">
                  {sessionStats.incorrectCount}
                </p>
                <p className="text-xs text-zinc-500 mt-1">To Review Again</p>
              </div>
            </div>

            {sessionStats.nextReviewTime && (
              <p className="text-xs text-zinc-500 mb-6">
                Next review:{" "}
                <span className="text-emerald-400 font-medium">
                  {formatRelativeDate(sessionStats.nextReviewTime)}
                </span>
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={endReview}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Browse
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleStartReview}
                disabled={dueCards.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Review Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Active Review Screen ----
  if (isReviewActive && reviewCard) {
    const cardProgress = getCardProgress(reviewCard.id);
    const status = getStatusBadge(cardProgress?.interval, !!cardProgress);

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Review Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-300"
            onClick={endReview}
          >
            <X className="h-4 w-4 mr-1" />
            Exit Review
          </Button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts((v) => !v)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <span className="text-xs text-zinc-500">
              {Math.min(reviewIndex + 1, reviewQueue.length)} / {reviewQueue.length}
            </span>
          </div>
        </div>

        {/* Shortcuts Tooltip */}
        {showShortcuts && (
          <div className="rounded-lg bg-zinc-800/80 border border-zinc-700/50 p-4 text-xs text-zinc-400">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">Space</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">Enter</kbd> Flip card</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">1</kbd> Again</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">2</kbd> Hard</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">3</kbd> Good</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">4</kbd> Easy</span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <Progress
            value={reviewProgress}
            className="h-1.5 flex-1 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <span className="text-xs text-zinc-500 shrink-0">
            {reviewIndex}/{reviewQueue.length}
          </span>
        </div>

        {/* Flashcard */}
        <div
          className="perspective-1000 cursor-pointer"
          onClick={!isFlipped ? handleFlip : undefined}
        >
          <div
            className={cn(
              "relative transition-transform duration-500 transform-style-3d",
              isFlipped && "rotate-y-180"
            )}
          >
            {/* Front */}
            <Card
              className={cn(
                "border-zinc-800 bg-zinc-900/50 min-h-[360px] flex flex-col backface-hidden",
                isFlipped && "invisible absolute inset-0"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-400 text-[10px]"
                  >
                    Domain {reviewCard.domain} &mdash; {reviewCard.domainName}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", getDifficultyBadge(reviewCard.difficulty))}
                    >
                      {reviewCard.difficulty}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center py-8 px-6">
                <Sparkles className="h-5 w-5 text-zinc-600 mb-4" />
                <p className="text-lg font-medium text-zinc-200 leading-relaxed text-center max-w-xl">
                  {reviewCard.question}
                </p>
                <p className="text-xs text-zinc-600 mt-8">
                  Click or press Space to reveal answer
                </p>
              </CardContent>
            </Card>

            {/* Back */}
            <Card
              className={cn(
                "border-zinc-800 bg-zinc-900/50 min-h-[360px] flex flex-col backface-hidden rotate-y-180",
                !isFlipped && "invisible absolute inset-0"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/10 text-emerald-400 text-[10px]"
                  >
                    Answer
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-400 text-[10px]"
                  >
                    {reviewCard.objectiveCode}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col py-6 px-6">
                <ScrollArea className="flex-1 max-h-[400px]">
                  {/* Answer */}
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
                      Answer
                    </p>
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
                      {reviewCard.answer}
                    </p>
                  </div>

                  {/* Explanation */}
                  <div className="mb-4 pt-4 border-t border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                      Explanation
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
                      {reviewCard.explanation}
                    </p>
                  </div>

                  {/* Source Link */}
                  {reviewCard.sourceUrl && (
                    <a
                      href={reviewCard.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source Reference
                    </a>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rating Buttons */}
        {isFlipped && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-zinc-600">How well did you know this?</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {(
                Object.entries(RATING_CONFIG) as [
                  SM2Rating,
                  (typeof RATING_CONFIG)[SM2Rating],
                ][]
              ).map(([key, config]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "min-w-[90px] border transition-colors flex flex-col h-auto py-2",
                    config.color
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(key);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-60 font-mono">
                      {config.shortcut}
                    </span>
                    {config.label}
                  </span>
                  <span className="text-[10px] opacity-50 font-normal">
                    {config.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
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
              style={{
                width: `${(stats.mastered / stats.total) * 100}%`,
              }}
            />
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{
                width: `${(stats.learning / stats.total) * 100}%`,
              }}
            />
            <div
              className="bg-blue-500/40 transition-all duration-500"
              style={{
                width: `${(stats.newCards / stats.total) * 100}%`,
              }}
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-zinc-500" />
            Card Library
          </h2>
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs placeholder:text-zinc-600 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Domain Tabs */}
        <Tabs value={domainFilter} onValueChange={setDomainFilter}>
          <TabsList className="bg-zinc-900/80 border border-zinc-800 h-auto flex-wrap">
            {DOMAIN_TABS.map((tab) => (
              <TabsTrigger
                key={tab.slug}
                value={tab.slug}
                className={cn(
                  "text-xs data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20",
                  "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab.label}
                {(dueCounts[tab.slug] ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                    {dueCounts[tab.slug]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Card Grid (shared content, all tabs filter on the same browsableCards) */}
          <div className="mt-4">
            {browsableCards.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No cards found matching your search.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-600 mb-3">
                  Showing {browsableCards.length} cards
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {browsableCards.map((card) => {
                    const cardProg = getCardProgress(card.id);
                    const cardStatus = getStatusBadge(cardProg?.interval, !!cardProg);
                    const isExpanded = expandedCard === card.id;

                    return (
                      <Card
                        key={card.id}
                        className={cn(
                          "border-zinc-800 bg-zinc-900/50 transition-all cursor-pointer",
                          isExpanded
                            ? "border-emerald-500/30 bg-zinc-900"
                            : "hover:border-zinc-700 hover:bg-zinc-900"
                        )}
                        onClick={() =>
                          setExpandedCard(isExpanded ? null : card.id)
                        }
                      >
                        <CardContent className="pt-5 pb-4">
                          {/* Badges Row */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="bg-zinc-800 text-zinc-400 text-[10px]"
                              >
                                D{card.domain}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] capitalize",
                                  getDifficultyBadge(card.difficulty)
                                )}
                              >
                                {card.difficulty}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className={cn("text-[10px]", cardStatus.className)}
                              >
                                {cardStatus.label}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                              )}
                            </div>
                          </div>

                          {/* Question */}
                          <p
                            className={cn(
                              "text-sm font-medium text-zinc-300 leading-relaxed",
                              !isExpanded && "line-clamp-2"
                            )}
                          >
                            {card.question}
                          </p>

                          {/* Expanded: Answer + Explanation */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                              <div>
                                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                                  Answer
                                </p>
                                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                                  {card.answer}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                  Explanation
                                </p>
                                <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">
                                  {card.explanation}
                                </p>
                              </div>
                              {card.sourceUrl && (
                                <a
                                  href={card.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Source
                                </a>
                              )}
                              {cardProg && (
                                <div className="flex items-center gap-3 text-[10px] text-zinc-600 pt-1">
                                  <span>Ease: {cardProg.ease.toFixed(2)}</span>
                                  <span>Interval: {cardProg.interval}d</span>
                                  <span>
                                    Next: {formatRelativeDate(cardProg.nextReview)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {!isExpanded && (
                            <div className="flex items-center gap-1 mt-3 text-xs text-zinc-600">
                              <ArrowRight className="h-3 w-3" />
                              <span>Click to expand</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
