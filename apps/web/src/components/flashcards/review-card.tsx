import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ExternalLink, Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDifficultyClasses } from "@/lib/ui-constants";
import type { Flashcard, FlashcardProgress } from "@/lib/flashcards";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(interval: number | undefined, hasProgress: boolean) {
  if (!hasProgress) return { label: "New", className: "bg-blue-500/10 text-blue-400" };
  if (interval !== undefined && interval > 21) return { label: "Mastered", className: "bg-emerald-500/10 text-emerald-400" };
  return { label: "Learning", className: "bg-amber-500/10 text-amber-400" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  card: Flashcard;
  cardProgress: FlashcardProgress | null | undefined;
  reviewIndex: number;
  queueLength: number;
  reviewProgress: number;
  isFlipped: boolean;
  showShortcuts: boolean;
  onFlip: () => void;
  onRate: (quality: number) => void;
  onSkip: () => void;
  onEndReview: () => void;
  onToggleShortcuts: () => void;
}

export function ReviewCard({
  card,
  cardProgress,
  reviewIndex,
  queueLength,
  reviewProgress,
  isFlipped,
  showShortcuts,
  onFlip,
  onRate,
  onSkip,
  onEndReview,
  onToggleShortcuts,
}: ReviewCardProps) {
  const status = getStatusBadge(cardProgress?.interval, !!cardProgress);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Review Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-300"
          onClick={onEndReview}
        >
          <X className="h-4 w-4 mr-1" />
          Exit Review
        </Button>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleShortcuts}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <span className="text-xs text-zinc-500">
            {Math.min(reviewIndex + 1, queueLength)} / {queueLength}
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
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono">S</kbd> Skip</span>
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
          {reviewIndex}/{queueLength}
        </span>
      </div>

      {/* Flashcard */}
      <div
        className="perspective-1000 cursor-pointer"
        onClick={!isFlipped ? onFlip : undefined}
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
                  Domain {card.domain} &mdash; {card.domainName}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px]", getDifficultyClasses(card.difficulty))}
                  >
                    {card.difficulty}
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
                {card.question}
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
                  {card.objectiveCode}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col py-6 px-6">
              <ScrollArea className="flex-1 max-h-[400px]">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
                    Answer
                  </p>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
                    {card.answer}
                  </p>
                </div>
                <div className="mb-4 pt-4 border-t border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                    Explanation
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
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
        <div className="relative z-10 flex flex-col items-center gap-3">
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
                  onRate(config.quality);
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
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-600 hover:text-zinc-400 text-xs mt-1"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            Skip <span className="text-[10px] opacity-60 font-mono ml-1">S</span>
          </Button>
        </div>
      )}
    </div>
  );
}
