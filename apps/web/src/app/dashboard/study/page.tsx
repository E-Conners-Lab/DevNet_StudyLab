"use client";

import { localFetch as fetch } from "@/lib/local/client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blueprint, labs } from "@/lib/local/catalog";

interface Objective {
  id: string;
  title: string;
  labSlug?: string;
}

interface StudyDomain {
  number: number;
  name: string;
  slug: string;
  weight: number;
  objectives: Objective[];
}

/** Use the same complete curriculum IDs as backups and progress calculations. */
const studyDomains: StudyDomain[] = blueprint.domains.map(domain => ({
  ...domain,
  objectives: domain.objectives.map(objective => ({
    id: objective.code, title: objective.title,
    labSlug: labs.find(lab => lab.objectiveCode === objective.code)?.slug,
  })),
}));

export default function StudyPage() {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set()
  );
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(
    new Set()
  );

  // Load locally saved study progress
  useEffect(() => {
    fetch("/api/study/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.completed && data.completed.length > 0) {
          setCompletedObjectives(new Set(data.completed));
        }
      })
      .catch(() => {
        // Keep empty progress if no saved data is available.
      });
  }, []);

  const toggleDomain = (slug: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleObjective = (id: string) => {
    const willComplete = !completedObjectives.has(id);
    setCompletedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // Persist locally; the global storage notice surfaces write failures.
    fetch("/api/study/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveCode: id, completed: willComplete }),
    }).catch(() => {
      // API unavailable — state change is still reflected in UI
    });
  };

  const totalObjectives = studyDomains.reduce(
    (acc, d) => acc + d.objectives.length,
    0
  );
  const totalCompleted = completedObjectives.size;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Study Hub
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Work through all exam objectives organized by domain
        </p>
      </div>

      {/* Overall Stats */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">Overall Completion</p>
              <p className="text-2xl font-bold text-zinc-100">
                {totalCompleted}{" "}
                <span className="text-base font-normal text-zinc-500">
                  / {totalObjectives} objectives
                </span>
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Progress
                value={(totalCompleted / totalObjectives) * 100}
                className="h-2 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
              />
              <p className="text-xs text-zinc-500 mt-1 text-right">
                {Math.round((totalCompleted / totalObjectives) * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Cards */}
      <div className="space-y-4">
        {studyDomains.map((domain) => {
          const isExpanded = expandedDomains.has(domain.slug);
          const domainCompleted = domain.objectives.filter((o) =>
            completedObjectives.has(o.id)
          ).length;
          const domainProgress = Math.round(
            (domainCompleted / domain.objectives.length) * 100
          );

          return (
            <Card
              key={domain.slug}
              className="border-zinc-800 bg-zinc-900/50 overflow-hidden"
            >
              {/* Domain header - clickable */}
              <button
                onClick={() => toggleDomain(domain.slug)}
                className="w-full text-left"
              >
                <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-500 shrink-0">
                      {domain.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold text-zinc-200">
                          {domain.name}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]"
                        >
                          {domain.weight}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Progress
                          value={domainProgress}
                          className="h-1.5 flex-1 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
                        />
                        <span className="text-xs text-zinc-500 shrink-0">
                          {domainCompleted}/{domain.objectives.length}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-zinc-500">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Objectives list */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="bg-zinc-800 mb-4" />
                  <div className="space-y-1">
                    {domain.objectives.map((objective) => {
                      const isCompleted = completedObjectives.has(objective.id);
                      return (
                        <div
                          key={objective.id}
                          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-800/30 transition-colors group"
                        >
                          <button
                            onClick={() => toggleObjective(objective.id)}
                            aria-label={`${isCompleted ? "Mark incomplete" : "Mark complete"}: ${objective.id}`}
                            aria-pressed={isCompleted}
                            className="mt-0.5 shrink-0"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/study/${domain.slug}`}
                              className={cn(
                                "text-sm leading-relaxed block rounded px-1 -mx-1 hover:bg-zinc-800/50 transition-colors",
                                isCompleted
                                  ? "text-zinc-500 line-through"
                                  : "text-zinc-300 hover:text-emerald-400"
                              )}
                            >
                              <span className="font-mono text-xs text-emerald-500/70 mr-2">
                                {objective.id}
                              </span>
                              {objective.title}
                            </Link>
                          </div>
                          {objective.labSlug && (
                            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link href={`/dashboard/labs/${objective.labSlug}`}>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-zinc-500 hover:text-emerald-400"
                                >
                                  <FlaskConical className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
