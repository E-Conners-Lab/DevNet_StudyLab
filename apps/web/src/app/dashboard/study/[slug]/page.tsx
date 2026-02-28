"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Target,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Resource {
  title: string;
  url: string;
}

interface KeyTopic {
  objectiveCode: string;
  title: string;
  summary: string;
  keyPoints: string[];
  examTips: string[];
  resources: Resource[];
}

interface StudyGuide {
  domain: number;
  slug: string;
  name: string;
  weight: number;
  overview: string;
  keyTopics: KeyTopic[];
  practiceScenarios: string[];
  commonMistakes: string[];
}

// ---------------------------------------------------------------------------
// Topic Card Component
// ---------------------------------------------------------------------------

function TopicCard({
  topic,
  defaultExpanded,
}: {
  topic: KeyTopic;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono shrink-0"
            >
              {topic.objectiveCode}
            </Badge>
            <CardTitle className="text-sm font-semibold text-zinc-200 flex-1">
              {topic.title}
            </CardTitle>
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

      {isExpanded && (
        <CardContent className="pt-0 space-y-5">
          <Separator className="bg-zinc-800" />

          {/* Summary */}
          <p className="text-sm text-zinc-400 leading-relaxed">
            {topic.summary}
          </p>

          {/* Key Points */}
          <div>
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Key Points
            </h4>
            <ul className="space-y-2">
              {topic.keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Exam Tips */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Exam Tips
            </h4>
            <ul className="space-y-2">
              {topic.examTips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-amber-200/80 leading-relaxed"
                >
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          {topic.resources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Resources
              </h4>
              <div className="space-y-1.5">
                {topic.resources.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 transition-colors group rounded-md px-2 py-1.5 -mx-2 hover:bg-zinc-800/50"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                    <span>{resource.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Study Domain Detail Page
// ---------------------------------------------------------------------------

export default function StudyDomainPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch study guide data
  useEffect(() => {
    async function fetchGuide() {
      try {
        setLoading(true);
        const res = await fetch(`/api/study/${slug}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? `Study guide "${slug}" not found`
              : `Failed to load study guide (${res.status})`
          );
        }
        const data: StudyGuide = await res.json();
        setGuide(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load study guide"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchGuide();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-500">Loading study guide...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !guide) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-zinc-800 bg-zinc-900/50 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <p className="text-sm text-zinc-300">
              {error ?? "Study guide not found"}
            </p>
            <Link href="/dashboard/study">
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Study Hub
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ===== Top Section ===== */}
      <div>
        <Link
          href="/dashboard/study"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-emerald-400 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Study Hub
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg font-bold text-emerald-500 shrink-0">
              {guide.domain}
            </span>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              {guide.name}
            </h1>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm w-fit"
          >
            {guide.weight}% of Exam
          </Badge>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl">
          {guide.overview}
        </p>
      </div>

      <Separator className="bg-zinc-800" />

      {/* ===== Main Content: Topics + Sidebar ===== */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* ----- Left Column: Topic Cards ----- */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-5">
            <GraduationCap className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-zinc-200">
              Exam Objectives
            </h2>
            <Badge
              variant="secondary"
              className="bg-zinc-800 text-zinc-400 text-[11px]"
            >
              {guide.keyTopics.length} topics
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="space-y-4 pr-2">
              {guide.keyTopics.map((topic, index) => (
                <TopicCard
                  key={topic.objectiveCode}
                  topic={topic}
                  defaultExpanded={index < 2}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ----- Right Column: Sidebar ----- */}
        <div className="lg:w-80 shrink-0 space-y-6">
          {/* Practice Scenarios */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Practice Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3">
                {guide.practiceScenarios.map((scenario, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-500 shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {scenario}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Common Mistakes */}
          <Card className="border-zinc-800 bg-zinc-900/50 border-l-2 border-l-amber-500/40">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Common Mistakes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3">
                {guide.commonMistakes.map((mistake, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {mistake}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
