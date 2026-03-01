// ---------------------------------------------------------------------------
// Shared UI Constants
// ---------------------------------------------------------------------------

/** Tailwind badge classes by difficulty level (covers both scales) */
export const DIFFICULTY_BADGE_CLASSES: Record<string, string> = {
  // Flashcard scale
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
  // Lab scale
  beginner: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function getDifficultyClasses(difficulty: string): string {
  return DIFFICULTY_BADGE_CLASSES[difficulty] ?? "bg-zinc-800 text-zinc-400";
}

/** Status badge for flashcard progress (New / Learning / Mastered) */
export function getStatusBadge(
  interval: number | undefined,
  hasProgress: boolean
): { label: string; className: string } {
  if (!hasProgress) return { label: "New", className: "bg-blue-500/10 text-blue-400" };
  if (interval !== undefined && interval > 21) return { label: "Mastered", className: "bg-emerald-500/10 text-emerald-400" };
  return { label: "Learning", className: "bg-amber-500/10 text-amber-400" };
}

/** Human-friendly relative date (e.g. "Tomorrow", "In 3 days") */
export function formatRelativeDate(dateStr: string): string {
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
