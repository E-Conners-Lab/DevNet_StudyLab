"use client";





import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExamQuestion {
  id: string;
  type: "multiple_choice" | "multiple_select" | "fill_in_the_blank" | "drag_and_drop";
  objective: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  options?: string[];
}

export interface ExamData {
  id: string;
  title: string;
  timeLimit: number; // minutes
  questions: ExamQuestion[];
}

export interface DomainScore {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface QuestionResult {
  questionId: string;
  text: string;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  correct: boolean;
  explanation: string;
}

export interface GradeResult {
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

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export function TimerDisplay({ timeLeft }: { timeLeft: number }) {
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

export function QuestionNav({
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

export function MultipleChoiceInput({
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

export function MultipleSelectInput({
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

export function FillBlankInput({
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

export function DragDropInput({
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
                aria-label={`Move ${item} up`}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={disabled || i === items.length - 1}
                onClick={() => moveDown(i)}
                aria-label={`Move ${item} down`}
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

export function ResultsView({
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
