"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DomainCard, type DomainData } from "@/components/dashboard/domain-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DEVNET_DOMAINS } from "@/lib/domains";
import {
  Target,
  Flame,
  Trophy,
  Clock,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Hardcoded defaults (used when DB is unavailable & for E2E tests)
// ---------------------------------------------------------------------------

const DEFAULT_PROGRESS: Record<number, { progress: number; stats: DomainData["stats"] }> = {
  1: { progress: 42, stats: { objectivesCompleted: 5, objectivesTotal: 12, flashcardsDue: 8, labsDone: 2, labsTotal: 4 } },
  2: { progress: 65, stats: { objectivesCompleted: 9, objectivesTotal: 14, flashcardsDue: 5, labsDone: 4, labsTotal: 6 } },
  3: { progress: 28, stats: { objectivesCompleted: 3, objectivesTotal: 11, flashcardsDue: 12, labsDone: 1, labsTotal: 5 } },
  4: { progress: 55, stats: { objectivesCompleted: 6, objectivesTotal: 10, flashcardsDue: 3, labsDone: 3, labsTotal: 5 } },
  5: { progress: 38, stats: { objectivesCompleted: 5, objectivesTotal: 13, flashcardsDue: 10, labsDone: 2, labsTotal: 6 } },
  6: { progress: 72, stats: { objectivesCompleted: 8, objectivesTotal: 11, flashcardsDue: 2, labsDone: 3, labsTotal: 4 } },
};

const defaultDomains: DomainData[] = DEVNET_DOMAINS.map((d) => ({
  number: d.number,
  name: d.name,
  slug: d.slug,
  weight: d.weight,
  ...DEFAULT_PROGRESS[d.number],
}));

const defaultRecentActivity = [
  {
    type: "study",
    text: 'Completed "REST API Fundamentals" objective',
    time: "2 hours ago",
    icon: BookOpen,
  },
  {
    type: "lab",
    text: 'Finished lab: "Python REST Client"',
    time: "5 hours ago",
    icon: FlaskConical,
  },
  {
    type: "exam",
    text: "Practice exam scored 78%",
    time: "Yesterday",
    icon: ClipboardCheck,
  },
  {
    type: "study",
    text: 'Reviewed "YANG Data Models" flashcards',
    time: "Yesterday",
    icon: BookOpen,
  },
];

const ACTIVITY_ICON_MAP: Record<string, typeof BookOpen> = {
  study: BookOpen,
  lab: FlaskConical,
  exam: ClipboardCheck,
  flashcard: BookOpen,
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [domains, setDomains] = useState<DomainData[]>(defaultDomains);
  const [overallProgress, setOverallProgress] = useState(() =>
    Math.round(defaultDomains.reduce((acc, d) => acc + d.progress * (d.weight / 100), 0)),
  );
  const [bestScore, setBestScore] = useState("85%");
  const [recentActivity, setRecentActivity] = useState(defaultRecentActivity);

  // Fetch live stats from API (replaces defaults if DB has data)
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) {
          const s = data.stats;
          if (s.domains && s.domains.length > 0) {
            setDomains(s.domains);
          }
          if (typeof s.overallProgress === "number") {
            setOverallProgress(s.overallProgress);
          }
          if (s.bestExamScore > 0) {
            setBestScore(`${s.bestExamScore}%`);
          }
          if (s.recentActivity && s.recentActivity.length > 0) {
            setRecentActivity(
              s.recentActivity.map(
                (a: { type: string; text: string; time: string }) => ({
                  ...a,
                  icon: ACTIVITY_ICON_MAP[a.type] ?? BookOpen,
                }),
              ),
            );
          }
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track your DevNet Associate 200-901 exam preparation progress
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Target}
          label="Overall Progress"
          value={`${overallProgress}%`}
          trend={{ value: "5%", positive: true }}
        />
        <StatsCard
          icon={Flame}
          label="Study Streak"
          value="7 days"
          trend={{ value: "3 days", positive: true }}
        />
        <StatsCard
          icon={Trophy}
          label="Best Score"
          value={bestScore}
          trend={{ value: "12%", positive: true }}
        />
        <StatsCard
          icon={Clock}
          label="Study Time"
          value="24h"
          trend={{ value: "2h", positive: true }}
        />
      </div>

      {/* Overall Progress Card */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Exam Readiness</CardTitle>
          <CardDescription>
            Weighted progress across all six exam domains
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-emerald-400">
              {overallProgress}%
            </span>
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              {overallProgress >= 80
                ? "Exam Ready"
                : overallProgress >= 50
                ? "On Track"
                : "Keep Going"}
            </Badge>
          </div>
          <Progress
            value={overallProgress}
            className="h-3 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <p className="text-xs text-zinc-500">
            {100 - overallProgress}% remaining to complete all domains
          </p>
        </CardContent>
      </Card>

      {/* Domain Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">
          Exam Domains
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((domain) => (
            <DomainCard key={domain.slug} domain={domain} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Recent Activity</CardTitle>
          <CardDescription>Your latest study sessions and completions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentActivity.map((activity, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                    <activity.icon className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300">{activity.text}</p>
                    <p className="text-xs text-zinc-600">{activity.time}</p>
                  </div>
                </div>
                {i < recentActivity.length - 1 && (
                  <Separator className="bg-zinc-800/50" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
