/**
 * Dashboard Data Access Layer
 *
 * Aggregates user progress across all tables to produce the dashboard
 * statistics. When the DB is unavailable, returns null so the page
 * can fall back to hardcoded defaults.
 */

import { eq, desc, count, max } from "drizzle-orm";
import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardDomainStats {
  number: number;
  name: string;
  slug: string;
  weight: number;
  progress: number;
  stats: {
    objectivesCompleted: number;
    objectivesTotal: number;
    flashcardsDue: number;
    labsDone: number;
    labsTotal: number;
  };
}

export interface DashboardStats {
  domains: DashboardDomainStats[];
  overallProgress: number;
  bestExamScore: number;
  totalExamAttempts: number;
  recentActivity: Array<{
    type: "study" | "lab" | "exam" | "flashcard";
    text: string;
    time: string;
  }>;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Fetch full dashboard stats for a user.
 * Returns null if DB is unavailable.
 */
export async function getDashboardStats(
  userId: string | null,
): Promise<DashboardStats | null> {
  if (!userId || !isDbConfigured()) return null;

  try {
    const db = getDb();

    // 1. Fetch all domains with objectives
    const allDomains = await db
      .select({
        id: schema.domains.id,
        slug: schema.domains.slug,
        name: schema.domains.name,
        weight: schema.domains.weight,
        orderIndex: schema.domains.orderIndex,
      })
      .from(schema.domains)
      .orderBy(schema.domains.orderIndex);

    if (allDomains.length === 0) return null;

    // 2. Count objectives per domain
    const objectiveCounts = await db
      .select({
        domainId: schema.objectives.domainId,
        total: count(),
      })
      .from(schema.objectives)
      .groupBy(schema.objectives.domainId);

    const objCountMap = new Map(objectiveCounts.map((r) => [r.domainId, r.total]));

    // 3. Get completed objectives for this user
    const completedObjectives = await db
      .select({
        domainId: schema.studyProgress.domainId,
        count: count(),
      })
      .from(schema.studyProgress)
      .where(eq(schema.studyProgress.userId, userId))
      .groupBy(schema.studyProgress.domainId);

    const completedMap = new Map(completedObjectives.map((r) => [r.domainId, r.count]));

    // 4. Flashcards due
    const flashcardsDue = await db
      .select({
        domainId: schema.domains.id,
        dueCount: count(),
      })
      .from(schema.flashcardProgress)
      .innerJoin(
        schema.flashcards,
        eq(schema.flashcardProgress.flashcardId, schema.flashcards.id),
      )
      .innerJoin(
        schema.objectives,
        eq(schema.flashcards.objectiveId, schema.objectives.id),
      )
      .innerJoin(
        schema.domains,
        eq(schema.objectives.domainId, schema.domains.id),
      )
      .where(eq(schema.flashcardProgress.userId, userId))
      .groupBy(schema.domains.id);

    // This gives total flashcard progress rows per domain. For "due", we'd
    // need to filter by nextReview, but raw SQL is needed for that.
    // Simplify: count total flashcards per domain and subtract reviewed ones.
    const totalFlashcardsPerDomain = await db
      .select({
        domainId: schema.domains.id,
        total: count(),
      })
      .from(schema.flashcards)
      .innerJoin(
        schema.objectives,
        eq(schema.flashcards.objectiveId, schema.objectives.id),
      )
      .innerJoin(
        schema.domains,
        eq(schema.objectives.domainId, schema.domains.id),
      )
      .groupBy(schema.domains.id);

    const totalFcMap = new Map(totalFlashcardsPerDomain.map((r) => [r.domainId, r.total]));
    const reviewedFcMap = new Map(flashcardsDue.map((r) => [r.domainId, r.dueCount]));

    // 5. Labs completed per domain
    const labsTotal = await db
      .select({
        domainId: schema.domains.id,
        total: count(),
      })
      .from(schema.labs)
      .innerJoin(
        schema.objectives,
        eq(schema.labs.objectiveId, schema.objectives.id),
      )
      .innerJoin(
        schema.domains,
        eq(schema.objectives.domainId, schema.domains.id),
      )
      .groupBy(schema.domains.id);

    const labsTotalMap = new Map(labsTotal.map((r) => [r.domainId, r.total]));

    const labsDone = await db
      .select({
        domainId: schema.domains.id,
        done: count(),
      })
      .from(schema.labAttempts)
      .innerJoin(schema.labs, eq(schema.labAttempts.labId, schema.labs.id))
      .innerJoin(
        schema.objectives,
        eq(schema.labs.objectiveId, schema.objectives.id),
      )
      .innerJoin(
        schema.domains,
        eq(schema.objectives.domainId, schema.domains.id),
      )
      .where(eq(schema.labAttempts.userId, userId))
      .groupBy(schema.domains.id);

    const labsDoneMap = new Map(labsDone.map((r) => [r.domainId, r.done]));

    // 6. Build domain stats
    const domainStats: DashboardDomainStats[] = allDomains.map((d, i) => {
      const objTotal = objCountMap.get(d.id) ?? 0;
      const objCompleted = completedMap.get(d.id) ?? 0;
      const totalFc = totalFcMap.get(d.id) ?? 0;
      const reviewedFc = reviewedFcMap.get(d.id) ?? 0;
      const labTotal = labsTotalMap.get(d.id) ?? 0;
      const labDone = labsDoneMap.get(d.id) ?? 0;

      const progress = objTotal > 0 ? Math.round((objCompleted / objTotal) * 100) : 0;

      return {
        number: i + 1,
        name: d.name,
        slug: d.slug,
        weight: d.weight,
        progress,
        stats: {
          objectivesCompleted: objCompleted,
          objectivesTotal: objTotal,
          flashcardsDue: Math.max(0, totalFc - reviewedFc),
          labsDone: labDone,
          labsTotal: labTotal,
        },
      };
    });

    // 7. Overall weighted progress
    const overallProgress = Math.round(
      domainStats.reduce((acc, d) => acc + d.progress * (d.weight / 100), 0),
    );

    // 8. Best exam score
    const bestScore = await db
      .select({ best: max(schema.practiceAttempts.score) })
      .from(schema.practiceAttempts)
      .where(eq(schema.practiceAttempts.userId, userId));

    const bestExamScore = Math.round(bestScore[0]?.best ?? 0);

    // 9. Total exam attempts
    const attemptCount = await db
      .select({ total: count() })
      .from(schema.practiceAttempts)
      .where(eq(schema.practiceAttempts.userId, userId));

    // 10. Recent activity (last 5 exam attempts for now)
    const recentExams = await db
      .select({
        score: schema.practiceAttempts.score,
        completedAt: schema.practiceAttempts.completedAt,
      })
      .from(schema.practiceAttempts)
      .where(eq(schema.practiceAttempts.userId, userId))
      .orderBy(desc(schema.practiceAttempts.completedAt))
      .limit(5);

    const recentActivity = recentExams.map((e) => ({
      type: "exam" as const,
      text: `Practice exam scored ${Math.round(e.score ?? 0)}%`,
      time: e.completedAt ? formatTimeAgo(e.completedAt) : "Recently",
    }));

    return {
      domains: domainStats,
      overallProgress,
      bestExamScore,
      totalExamAttempts: attemptCount[0]?.total ?? 0,
      recentActivity,
    };
  } catch (err) {
    console.warn("Failed to load dashboard stats from DB:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
