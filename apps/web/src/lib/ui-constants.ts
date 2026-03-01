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
