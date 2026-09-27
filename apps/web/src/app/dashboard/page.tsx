"use client";

import { localFetch as fetch } from "@/lib/local/client";

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
// Empty initial state until bundled local progress loads
// ---------------------------------------------------------------------------

const defaultDomains: DomainData[] = DEVNET_DOMAINS.map(d => ({...d, progress:0, stats:{objectivesCompleted:0, objectivesTotal:0, flashcardsDue:0, labsDone:0, labsTotal:0}}));
const defaultRecentActivity: {type:string; text:string; time:string; icon:typeof BookOpen}[] = [];

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
  const [bestScore, setBestScore] = useState("—");
  const [recentActivity, setRecentActivity] = useState(defaultRecentActivity);

  // Read local study statistics
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
        // Keep empty progress if no saved data is available.
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
          Your local progress through the historical DevNet 200-901 curriculum
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Target}
          label="Overall Progress"
          value={`${overallProgress}%`}
        />
        <StatsCard
          icon={Flame}
          label="Objectives completed"
          value={String(domains.reduce((sum, domain) => sum + domain.stats.objectivesCompleted, 0))}
        />
        <StatsCard
          icon={Trophy}
          label="Best Score"
          value={bestScore}
        />
        <StatsCard
          icon={Clock}
          label="Labs completed"
          value={String(domains.reduce((sum, domain) => sum + domain.stats.labsDone, 0))}
        />
      </div>

      {/* Overall Progress Card */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Curriculum Progress</CardTitle>
          <CardDescription>
            Completed objectives across all six curriculum domains
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
                ? "Nearly complete"
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
