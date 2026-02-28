"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatsCard } from "@/components/dashboard/stats-card";
import {
  Play,
  Clock,
  Target,
  Trophy,
  BarChart3,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PastAttempt {
  id: string;
  type: "full" | "domain";
  domain?: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  date: string;
  timeTaken: string;
  passed: boolean;
}

const defaultAttempts: PastAttempt[] = [
  {
    id: "1",
    type: "full",
    score: 78,
    totalQuestions: 40,
    correctAnswers: 31,
    date: "Feb 25, 2026",
    timeTaken: "1h 42m",
    passed: true,
  },
  {
    id: "2",
    type: "domain",
    domain: "Understanding & Using APIs",
    score: 85,
    totalQuestions: 15,
    correctAnswers: 13,
    date: "Feb 23, 2026",
    timeTaken: "28m",
    passed: true,
  },
  {
    id: "3",
    type: "full",
    score: 62,
    totalQuestions: 40,
    correctAnswers: 25,
    date: "Feb 20, 2026",
    timeTaken: "1h 55m",
    passed: false,
  },
  {
    id: "4",
    type: "domain",
    domain: "Infrastructure & Automation",
    score: 53,
    totalQuestions: 15,
    correctAnswers: 8,
    date: "Feb 18, 2026",
    timeTaken: "32m",
    passed: false,
  },
  {
    id: "5",
    type: "domain",
    domain: "Network Fundamentals",
    score: 90,
    totalQuestions: 12,
    correctAnswers: 11,
    date: "Feb 15, 2026",
    timeTaken: "18m",
    passed: true,
  },
];

/** Format seconds into a human-readable string like "1h 42m" or "28m" */
function formatTimeTaken(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalMin = Math.round(ms / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMin}m`;
}

/** Format an ISO date string to a human-readable date */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const domainOptions = [
  { value: "all", label: "All Domains" },
  { value: "software-dev", label: "1. Software Development & Design" },
  { value: "apis", label: "2. Understanding & Using APIs" },
  { value: "cisco-platforms", label: "3. Cisco Platforms & Development" },
  { value: "deployment-security", label: "4. Application Deployment & Security" },
  { value: "infrastructure-automation", label: "5. Infrastructure & Automation" },
  { value: "network-fundamentals", label: "6. Network Fundamentals" },
];

export default function PracticePage() {
  const router = useRouter();
  const [domainFilter, setDomainFilter] = useState("all");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>(defaultAttempts);

  // Fetch real attempts from API (replaces defaults if DB has data)
  useEffect(() => {
    fetch("/api/exams/attempts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.attempts && data.attempts.length > 0) {
          const mapped: PastAttempt[] = data.attempts.map(
            (a: {
              id: string;
              score: number;
              totalQuestions: number;
              domainFilter: string | null;
              startedAt: string;
              completedAt: string | null;
            }) => ({
              id: a.id,
              type: a.domainFilter ? ("domain" as const) : ("full" as const),
              domain: a.domainFilter ?? undefined,
              score: Math.round(a.score),
              totalQuestions: a.totalQuestions,
              correctAnswers: Math.round((a.score / 100) * a.totalQuestions),
              date: formatDate(a.startedAt),
              timeTaken: formatTimeTaken(a.startedAt, a.completedAt),
              passed: a.score >= 70,
            }),
          );
          setPastAttempts(mapped);
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  const totalAttempts = pastAttempts.length;
  const avgScore = Math.round(
    pastAttempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts
  );
  const bestScore = Math.max(...pastAttempts.map((a) => a.score));
  const passRate = Math.round(
    (pastAttempts.filter((a) => a.passed).length / totalAttempts) * 100
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Practice Exams
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Test your knowledge with practice questions modeled after the 200-901
          exam
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={BarChart3}
          label="Total Attempts"
          value={totalAttempts}
        />
        <StatsCard
          icon={Target}
          label="Average Score"
          value={`${avgScore}%`}
          trend={{ value: "5%", positive: true }}
        />
        <StatsCard
          icon={Trophy}
          label="Best Score"
          value={`${bestScore}%`}
        />
        <StatsCard
          icon={CheckCircle2}
          label="Pass Rate"
          value={`${passRate}%`}
          trend={{ value: "10%", positive: true }}
        />
      </div>

      {/* Start New Exam */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Start New Exam</CardTitle>
          <CardDescription>
            Take a full practice exam or focus on a specific domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Exam */}
            <Card className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      Full Practice Exam
                    </p>
                    <p className="text-xs text-zinc-500">
                      40 questions, all domains
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                  <Clock className="h-3 w-3" />
                  <span>60 minutes</span>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => router.push("/dashboard/practice/exam?examId=sample-exam-1")}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Full Exam
                </Button>
              </CardContent>
            </Card>

            {/* Domain Exam */}
            <Card className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Filter className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      Domain Quiz
                    </p>
                    <p className="text-xs text-zinc-500">
                      10-15 questions, focused
                    </p>
                  </div>
                </div>
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="w-full mb-4 bg-zinc-900 border-zinc-700 text-zinc-300 text-xs">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {domainOptions.slice(1).map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-zinc-300 text-xs focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                  disabled={!selectedDomain}
                  onClick={() => {
                    if (selectedDomain) {
                      router.push(`/dashboard/practice/exam?examId=domain-quiz&domain=${selectedDomain}`);
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Domain Quiz
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Past Attempts */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-zinc-200">Past Attempts</CardTitle>
              <CardDescription>Review your previous exam results</CardDescription>
            </div>
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-zinc-300 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {domainOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-zinc-300 text-xs focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {pastAttempts.map((attempt, i) => (
              <div key={attempt.id}>
                <div className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
                  {/* Score circle */}
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 shrink-0",
                      attempt.passed
                        ? "border-emerald-500/30 text-emerald-400"
                        : "border-red-500/30 text-red-400"
                    )}
                  >
                    <span className="text-sm font-bold">{attempt.score}%</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-200">
                        {attempt.type === "full"
                          ? "Full Practice Exam"
                          : attempt.domain}
                      </p>
                      {attempt.passed ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                        >
                          Passed
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]"
                        >
                          Failed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500/50" />
                        {attempt.correctAnswers}/{attempt.totalQuestions} correct
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {attempt.timeTaken}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {attempt.date}
                      </span>
                    </div>
                  </div>

                  {/* Review button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500 hover:text-zinc-300 shrink-0"
                  >
                    Review
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                {i < pastAttempts.length - 1 && (
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
