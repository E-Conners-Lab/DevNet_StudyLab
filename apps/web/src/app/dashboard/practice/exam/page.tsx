"use client";

import { localFetch as fetch } from "@/lib/local/client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { TimerDisplay, QuestionNav, MultipleChoiceInput, MultipleSelectInput, FillBlankInput, DragDropInput, ResultsView, DIFFICULTY_COLORS, type ExamData, type GradeResult } from './exam-ui';

// ---------------------------------------------------------------------------
// Main Exam Component (reads searchParams)
// ---------------------------------------------------------------------------

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("examId") ?? "sample-exam-1";
  const domain = searchParams.get("domain");

  // ---- State ----
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // ---- Fetch exam ----
  useEffect(() => {
    async function fetchExam() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (domain) params.set("domain", domain);
        const url = `/api/exams/${examId}${params.toString() ? `?${params}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load exam (${res.status})`);
        const data: ExamData = await res.json();
        setExamData(data);
        setTimeLeft(data.timeLimit * 60);

        // Pre-populate drag_and_drop answers with default order
        const initial: Record<string, string | string[]> = {};
        for (const q of data.questions) {
          if (q.type === "drag_and_drop" && q.options) {
            initial[q.id] = [...q.options];
          }
        }
        setAnswers(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exam");
      } finally {
        setLoading(false);
      }
    }
    fetchExam();
  }, [examId, domain]);

  // ---- Timer ----
  useEffect(() => {
    if (!examData || results) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time is up - auto submit
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examData, results]);

  // ---- Auto-submit when timer hits 0 ----
  useEffect(() => {
    if (timeLeft === 0 && examData && !results && !submittedRef.current) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ---- Submit ----
  const handleSubmit = useCallback(async () => {
    if (!examData || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeTaken = examData.timeLimit * 60 - timeLeft;
      const gradeParams = new URLSearchParams();
      if (domain) gradeParams.set("domain", domain);
      const gradeUrl = `/api/exams/${examId}/grade${gradeParams.toString() ? `?${gradeParams}` : ""}`;
      const res = await fetch(gradeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeTaken }),
      });
      if (!res.ok) throw new Error(`Grading failed (${res.status})`);
      const data: GradeResult = await res.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit exam");
      submittedRef.current = false; // allow retry
    } finally {
      setSubmitting(false);
    }
  }, [examData, examId, domain, answers, timeLeft]);

  // ---- Answer handlers ----
  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  // ---- Navigation ----
  function goTo(idx: number) {
    if (examData && idx >= 0 && idx < examData.questions.length) {
      setCurrentIndex(idx);
    }
  }

  function handleBack() {
    router.push("/dashboard/practice");
  }

  // ---- Render states ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-500">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-zinc-800 bg-zinc-900/50 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <p className="text-sm text-zinc-300">{error}</p>
            <Button
              onClick={handleBack}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!examData) return null;

  // ---- Results view ----
  if (results) {
    return <ResultsView results={results} examData={examData} onBack={handleBack} />;
  }

  // ---- Exam view ----
  const question = examData.questions[currentIndex];
  const totalQuestions = examData.questions.length;
  const answeredCount = Object.entries(answers).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== "";
  }).length;

  const currentAnswer = answers[question.id];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold text-zinc-200 truncate hidden sm:block">
            {examData.title}
          </h1>
          <Badge
            variant="secondary"
            className="bg-zinc-800 text-zinc-400 border-zinc-700 shrink-0"
          >
            {answeredCount}/{totalQuestions}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <TimerDisplay timeLeft={timeLeft} />
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
          >
            {submitting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1" />
            )}
            Submit Exam
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 px-4 pt-2">
        <Progress
          value={(answeredCount / totalQuestions) * 100}
          className="h-1 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 pt-2">
        {/* Left Sidebar - Question Navigation (desktop only) */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-zinc-800 px-4 py-4">
          <p className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
            Questions
          </p>
          <QuestionNav
            questions={examData.questions}
            currentIndex={currentIndex}
            answers={answers}
            flagged={flagged}
            onSelect={goTo}
          />
          <div className="mt-4 space-y-1.5 text-[10px] text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-zinc-700 shrink-0" />
              Unanswered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-emerald-500/80 shrink-0" />
              Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-500/80 shrink-0" />
              Flagged
            </div>
          </div>
        </aside>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 pb-24 space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-400">
                    Question {currentIndex + 1}
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]"
                  >
                    {question.objective}
                  </Badge>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] capitalize",
                    DIFFICULTY_COLORS[question.difficulty]
                  )}
                >
                  {question.difficulty}
                </Badge>
              </div>

              {/* Question Text */}
              <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {question.text}
              </div>

              {/* Answer Input */}
              <div>
                {question.type === "multiple_choice" && (
                  <MultipleChoiceInput
                    question={question}
                    value={(currentAnswer as string) ?? ""}
                    onChange={(val) => setAnswer(question.id, val)}
                  />
                )}

                {question.type === "multiple_select" && (
                  <MultipleSelectInput
                    question={question}
                    value={
                      Array.isArray(currentAnswer)
                        ? (currentAnswer as string[])
                        : []
                    }
                    onChange={(val) => setAnswer(question.id, val)}
                  />
                )}

                {question.type === "fill_in_the_blank" && (
                  <FillBlankInput
                    value={(currentAnswer as string) ?? ""}
                    onChange={(val) => setAnswer(question.id, val)}
                  />
                )}

                {question.type === "drag_and_drop" && (
                  <DragDropInput
                    question={question}
                    value={
                      Array.isArray(currentAnswer)
                        ? (currentAnswer as string[])
                        : []
                    }
                    onChange={(val) => setAnswer(question.id, val)}
                  />
                )}
              </div>

              {/* Flag + Nav Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFlag(question.id)}
                  className={cn(
                    "text-xs",
                    flagged.has(question.id)
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Flag
                    className={cn(
                      "h-3.5 w-3.5 mr-1",
                      flagged.has(question.id) && "fill-amber-400"
                    )}
                  />
                  {flagged.has(question.id) ? "Flagged" : "Flag"}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndex === 0}
                    onClick={() => goTo(currentIndex - 1)}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndex === totalQuestions - 1}
                    onClick={() => goTo(currentIndex + 1)}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Mobile Question Nav */}
              <div className="lg:hidden pt-4">
                <p className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
                  Question Navigator
                </p>
                <QuestionNav
                  questions={examData.questions}
                  currentIndex={currentIndex}
                  answers={answers}
                  flagged={flagged}
                  onSelect={goTo}
                />
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Export (with Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-zinc-500">Loading...</p>
          </div>
        </div>
      }
    >
      <ExamContent />
    </Suspense>
  );
}
