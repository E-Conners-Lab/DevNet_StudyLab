import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft, RotateCcw } from "lucide-react";

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

interface ReviewCompleteProps {
  sessionStats: {
    cardsReviewed: number;
    correctCount: number;
    incorrectCount: number;
    nextReviewTime: string | null;
  };
  dueCardsCount: number;
  onEndReview: () => void;
  onStartReview: () => void;
}

export function ReviewComplete({
  sessionStats,
  dueCardsCount,
  onEndReview,
  onStartReview,
}: ReviewCompleteProps) {
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
              onClick={onEndReview}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={onStartReview}
              disabled={dueCardsCount === 0}
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
