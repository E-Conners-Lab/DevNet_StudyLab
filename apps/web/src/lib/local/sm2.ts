import type { CardProgress } from "./schema";
export function reviewCard(id: string, quality: number, previous?: CardProgress, now = new Date()): CardProgress {
    if (!Number.isInteger(quality) || quality < 0 || quality > 5)
        throw new Error("Review quality must be an integer from 0 to 5.");
    const reps = previous?.repetitions ?? 0, ease = previous?.ease ?? 2.5, interval = previous?.interval ?? 0;
    const nextInterval = quality < 3 ? 1 : reps === 0 ? 1 : reps === 1 ? 6 : Math.min(1000000, Math.round(interval * ease));
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + nextInterval);
    return { flashcardId: id, quality, repetitions: quality < 3 ? 0 : Math.min(1000000, reps + 1), ease: Math.min(100, Math.max(1.3, Math.round((ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)) * 100) / 100)), interval: nextInterval, lastReview: now.toISOString(), nextReview: next.toISOString() };
}
