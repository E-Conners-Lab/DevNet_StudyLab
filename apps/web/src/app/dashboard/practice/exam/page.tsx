"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Send,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamQuestion {
  id: string;
  type: "multiple_choice" | "multiple_select" | "fill_in_the_blank" | "drag_and_drop";
  objective: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  options?: string[];
}

interface ExamData {
  id: string;
  title: string;
  timeLimit: number; // minutes
  questions: ExamQuestion[];
}

interface DomainScore {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

interface QuestionResult {
  questionId: string;
  text: string;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  correct: boolean;
  explanation: string;
}

interface GradeResult {
  score: number;
  totalCorrect: number;
  totalQuestions: number;
  passed: boolean;
  domainBreakdown: DomainScore[];
  questionResults: QuestionResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimerDisplay({ timeLeft }: { timeLeft: number }) {
  const warning = timeLeft <= 60;
  const caution = timeLeft <= 300 && !warning;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-sm tabular-nums",
        warning && "text-red-400",
        caution && "text-amber-400",
        !warning && !caution && "text-zinc-300"
      )}
    >
      <Clock
        className={cn(
          "h-4 w-4",
          warning && "text-red-400",
          caution && "text-amber-400"
        )}
      />
      {warning && <AlertTriangle className="h-3.5 w-3.5" />}
      {formatTime(timeLeft)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Navigation Sidebar
// ---------------------------------------------------------------------------

function QuestionNav({
  questions,
  currentIndex,
  answers,
  flagged,
  onSelect,
}: {
  questions: ExamQuestion[];
  currentIndex: number;
  answers: Record<string, string | string[]>;
  flagged: Set<string>;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {questions.map((q, i) => {
        const answered =
          answers[q.id] !== undefined &&
          answers[q.id] !== "" &&
          (Array.isArray(answers[q.id])
            ? (answers[q.id] as string[]).length > 0
            : true);
        const isFlagged = flagged.has(q.id);
        const isCurrent = i === currentIndex;

        return (
          <button
            key={q.id}
            onClick={() => onSelect(i)}
            className={cn(
              "flex items-center justify-center h-8 w-full rounded text-xs font-medium transition-colors",
              isCurrent && "ring-2 ring-emerald-400",
              isFlagged && !isCurrent && "bg-amber-500/80 text-zinc-950",
              answered && !isFlagged && !isCurrent && "bg-emerald-500/80 text-zinc-950",
              !answered && !isFlagged && !isCurrent && "bg-zinc-700 text-zinc-300",
              isFlagged && isCurrent && "bg-amber-500/80 text-zinc-950 ring-2 ring-emerald-400",
              answered && isCurrent && !isFlagged && "bg-emerald-500/80 text-zinc-950"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple Choice
// ---------------------------------------------------------------------------

function MultipleChoiceInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ExamQuestion;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
      {question.options?.map((opt, i) => {
        const letter = OPTION_LETTERS[i];
        const isSelected = value === letter;
        return (
          <Label
            key={letter}
            htmlFor={`${question.id}-${letter}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              isSelected
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/60",
              disabled && "cursor-default opacity-70"
            )}
          >
            <RadioGroupItem
              value={letter}
              id={`${question.id}-${letter}`}
              className="border-zinc-600 text-emerald-500"
            />
            <span className="text-xs font-semibold text-zinc-500 shrink-0">
              {letter}.
            </span>
            <span className="text-sm text-zinc-200">{opt}</span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

// ---------------------------------------------------------------------------
// Multiple Select
// ---------------------------------------------------------------------------

function MultipleSelectInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ExamQuestion;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(letter: string) {
    if (disabled) return;
    if (value.includes(letter)) {
      onChange(value.filter((v) => v !== letter));
    } else {
      onChange([...value, letter]);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 italic">Select all that apply</p>
      <div className="grid gap-3">
        {question.options?.map((opt, i) => {
          const letter = OPTION_LETTERS[i];
          const isSelected = value.includes(letter);
          return (
            <div
              key={letter}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && toggle(letter)}
              onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(letter); } }}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer",
                isSelected
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/60",
                disabled && "cursor-default opacity-70 pointer-events-none"
              )}
            >
              <Checkbox
                checked={isSelected}
                className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                tabIndex={-1}
              />
              <span className="text-xs font-semibold text-zinc-500 shrink-0">
                {letter}.
              </span>
              <span className="text-sm text-zinc-200">{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fill in the Blank
// ---------------------------------------------------------------------------

function FillBlankInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-400">Your answer</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer..."
        disabled={disabled}
        className="bg-zinc-800/50 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag and Drop (reorder with Up/Down buttons)
// ---------------------------------------------------------------------------

function DragDropInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ExamQuestion;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) {
  // Initialize with the original options order if value is empty
  const items =
    value.length > 0 ? value : question.options ?? [];

  function moveUp(idx: number) {
    if (disabled || idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(idx: number) {
    if (disabled || idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 italic">
        Arrange the items in the correct order using the arrow buttons
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3"
          >
            <span className="text-xs font-semibold text-zinc-500 w-5 shrink-0 text-center">
              {i + 1}.
            </span>
            <span className="text-sm text-zinc-200 flex-1">{item}</span>
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={disabled || i === 0}
                onClick={() => moveUp(i)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={disabled || i === items.length - 1}
                onClick={() => moveDown(i)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results View
// ---------------------------------------------------------------------------

function ResultsView({
  results,
  examData,
  onBack,
}: {
  results: GradeResult;
  examData: ExamData;
  onBack: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Score Header */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full border-4",
                results.passed
                  ? "border-emerald-500/50 text-emerald-400"
                  : "border-red-500/50 text-red-400"
              )}
            >
              <span className="text-3xl font-bold">
                {Math.round(results.score)}%
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">
                {examData.title}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {results.totalCorrect} of {results.totalQuestions} correct
              </p>
            </div>
            {results.passed ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm px-4 py-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                PASSED
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-sm px-4 py-1">
                <XCircle className="h-4 w-4 mr-1" />
                FAILED
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Domain Breakdown */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Domain Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.domainBreakdown.map((d) => (
              <div key={d.domain} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300 truncate pr-4">
                    {d.domain}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0",
                      d.percentage >= 70 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {d.correct}/{d.total} ({Math.round(d.percentage)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      d.percentage >= 70 ? "bg-emerald-500" : "bg-red-500"
                    )}
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-question Review */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Question Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.questionResults.map((qr, i) => (
              <div
                key={qr.questionId}
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  qr.correct
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-200">
                    <span className="font-semibold text-zinc-400 mr-2">
                      Q{i + 1}.
                    </span>
                    {qr.text}
                  </p>
                  {qr.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Your answer: </span>
                    <span
                      className={cn(
                        "font-medium",
                        qr.correct ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {Array.isArray(qr.userAnswer)
                        ? qr.userAnswer.join(", ")
                        : qr.userAnswer || "(no answer)"}
                    </span>
                  </div>
                  {!qr.correct && (
                    <div>
                      <span className="text-zinc-500">Correct answer: </span>
                      <span className="font-medium text-emerald-400">
                        {Array.isArray(qr.correctAnswer)
                          ? qr.correctAnswer.join(", ")
                          : qr.correctAnswer}
                      </span>
                    </div>
                  )}
                </div>

                {qr.explanation && (
                  <p className="text-xs text-zinc-400 border-t border-zinc-800 pt-2">
                    {qr.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={onBack}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice
        </Button>
      </div>
    </div>
  );
}

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
