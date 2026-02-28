"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Eye,
  Lightbulb,
  Clock,
  Terminal,
  BookOpen,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabData {
  slug: string;
  title: string;
  description: string;
  domain: string;
  domainSlug: string;
  objectiveCode: string;
  difficulty: string;
  estimatedMinutes: number;
  type: string;
  tags: string[];
  instructions: string;
  starterCode: string;
  hints: string[];
  learningObjectives: string[];
}

interface LabSolution {
  solutionCode: string;
  expectedOutput: string;
}

interface RunResult {
  success: boolean;
  output: string;
  executionTime: number;
  engineAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Difficulty badge colors
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-400 border-red-500/20",
};

// ---------------------------------------------------------------------------
// Simple markdown-to-HTML renderer
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  let html = text
    // Code blocks (triple backtick) - must come before inline code
    .replace(
      /```(?:\w*)\n([\s\S]*?)```/g,
      '<pre class="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm text-emerald-400 font-mono">$1</code></pre>'
    )
    // Inline code (backtick)
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
    )
    // Headers
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-base font-semibold text-zinc-200 mt-6 mb-2">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-lg font-semibold text-zinc-100 mt-8 mb-3">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-xl font-bold text-zinc-50 mt-6 mb-4">$1</h1>'
    )
    // Horizontal rules
    .replace(
      /^---$/gm,
      '<hr class="border-zinc-800 my-6" />'
    )
    // Bold
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-zinc-100 font-semibold">$1</strong>'
    )
    // Italic
    .replace(
      /\*(.+?)\*/g,
      '<em class="text-zinc-300">$1</em>'
    )
    // Unordered list items
    .replace(
      /^- (.+)$/gm,
      '<li class="text-sm text-zinc-400 ml-4 list-disc leading-relaxed">$1</li>'
    )
    // Ordered list items
    .replace(
      /^\d+\. (.+)$/gm,
      '<li class="text-sm text-zinc-400 ml-4 list-decimal leading-relaxed">$1</li>'
    )
    // Paragraphs - wrap remaining non-html lines
    .replace(
      /^(?!<[hluopre])((?!<).+)$/gm,
      '<p class="text-sm text-zinc-400 leading-relaxed my-2">$1</p>'
    );

  // Wrap consecutive <li> items in <ul> or <ol>
  html = html.replace(
    /(<li class="text-sm text-zinc-400 ml-4 list-disc[^"]*">[\s\S]*?<\/li>\n?)+/g,
    '<ul class="space-y-1 my-3">$&</ul>'
  );
  html = html.replace(
    /(<li class="text-sm text-zinc-400 ml-4 list-decimal[^"]*">[\s\S]*?<\/li>\n?)+/g,
    '<ol class="space-y-1 my-3">$&</ol>'
  );

  return html;
}

// ---------------------------------------------------------------------------
// Line Numbers Component
// ---------------------------------------------------------------------------

function LineNumbers({ count }: { count: number }) {
  return (
    <div className="select-none text-right pr-3 py-4 text-xs font-mono text-zinc-600 leading-[1.625rem]">
      {Array.from({ length: count }, (_, i) => (
        <div key={i + 1}>{i + 1}</div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lab Execution Page
// ---------------------------------------------------------------------------

export default function LabExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // State
  const [lab, setLab] = useState<LabData | null>(null);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionData, setSolutionData] = useState<LabSolution | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<boolean | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalCode = useRef("");

  // ---- Fetch lab data ----
  useEffect(() => {
    async function fetchLab() {
      try {
        setLoading(true);
        const res = await fetch(`/api/labs/${slug}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? `Lab "${slug}" not found`
              : `Failed to load lab (${res.status})`
          );
        }
        const data: LabData = await res.json();
        setLab(data);
        // Editor starts blank — the instructions panel tells the user
        // what to build. Starter code is kept in the data for reference
        // but not pre-loaded into the editor.
        setCode("");
        originalCode.current = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lab");
      } finally {
        setLoading(false);
      }
    }
    fetchLab();
  }, [slug]);

  // ---- Run code ----
  const handleRun = useCallback(async () => {
    if (!lab || isRunning) return;
    setIsRunning(true);
    setOutput("");
    setRunSuccess(null);
    setExecutionTime(null);
    // run completed

    try {
      const res = await fetch(`/api/labs/${slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const result: RunResult = await res.json();
      setOutput(result.output);
      setRunSuccess(result.success);
      setExecutionTime(result.executionTime);
    } catch (err) {
      setOutput(
        err instanceof Error ? err.message : "Failed to execute code"
      );
      setRunSuccess(false);
    } finally {
      setIsRunning(false);
    }
  }, [lab, slug, code, isRunning]);

  // ---- Reset code ----
  const handleReset = useCallback(() => {
    setCode(originalCode.current);
    setOutput("");
    setRunSuccess(null);
    setExecutionTime(null);
  }, []);

  // ---- Show solution ----
  const handleShowSolution = useCallback(async () => {
    if (showSolution) {
      setShowSolution(false);
      return;
    }

    if (!solutionData) {
      try {
        const res = await fetch(`/api/labs/${slug}/solution`);
        if (res.ok) {
          const data: LabSolution = await res.json();
          setSolutionData(data);
        }
      } catch {
        // Silently handle
      }
    }

    setShowSolution(true);
  }, [showSolution, solutionData, slug]);

  // ---- Reveal next hint ----
  const handleRevealHint = useCallback(() => {
    if (lab && hintsRevealed < lab.hints.length) {
      setHintsRevealed((prev) => prev + 1);
    }
  }, [lab, hintsRevealed]);

  // ---- Handle tab key in textarea ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = "    ";

        setCode(
          (prev) => prev.substring(0, start) + spaces + prev.substring(end)
        );

        // Restore cursor position after state update
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + spaces.length;
        });
      }
    },
    []
  );

  // ---- Copy code to clipboard ----
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently handle
    }
  }, [code]);

  // ---- Compute line count ----
  const lineCount = code.split("\n").length;

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-500">Loading lab...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !lab) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-zinc-800 bg-zinc-900/50 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <p className="text-sm text-zinc-300">
              {error ?? "Lab not found"}
            </p>
            <Button
              onClick={() => router.push("/dashboard/labs")}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Labs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main layout ----
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
      {/* ===== Top Bar ===== */}
      <div className="shrink-0 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            onClick={() => router.push("/dashboard/labs")}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-200 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Labs</span>
          </Button>
          <Separator orientation="vertical" className="h-5 bg-zinc-800" />
          <h1 className="text-sm font-semibold text-zinc-200 truncate">
            {lab.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] capitalize",
              DIFFICULTY_COLORS[lab.difficulty] ?? "bg-zinc-800 text-zinc-400"
            )}
          >
            {lab.difficulty}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <span>{lab.estimatedMinutes} min</span>
          </div>
        </div>
      </div>

      {/* ===== Split View ===== */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* ----- Left Panel: Instructions (60%) ----- */}
        <div className="lg:w-[60%] w-full border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col min-h-0">
          <Tabs defaultValue="instructions" className="flex flex-col flex-1 min-h-0 gap-0">
            <div className="shrink-0 border-b border-zinc-800 px-4">
              <TabsList className="bg-transparent h-10 gap-0 p-0 rounded-none">
                <TabsTrigger
                  value="instructions"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:border-b-2 data-[state=active]:border-emerald-400 rounded-none text-xs text-zinc-500 px-4 h-10"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  Instructions
                </TabsTrigger>
                <TabsTrigger
                  value="hints"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:border-b-2 data-[state=active]:border-emerald-400 rounded-none text-xs text-zinc-500 px-4 h-10"
                >
                  <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                  Hints
                  {lab.hints.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1.5 bg-zinc-800 text-zinc-500 text-[10px] px-1.5"
                    >
                      {hintsRevealed}/{lab.hints.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="instructions" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {/* Learning Objectives */}
                  {lab.learningObjectives.length > 0 && (
                    <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                        Learning Objectives
                      </h3>
                      <ul className="space-y-1">
                        {lab.learningObjectives.map((obj, i) => (
                          <li
                            key={i}
                            className="text-xs text-zinc-400 flex items-start gap-2"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rendered instructions */}
                  <div
                    className="prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(lab.instructions),
                    }}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="hints" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  {lab.hints.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No hints available for this lab.
                    </p>
                  ) : (
                    <>
                      {lab.hints.map((hint, i) => (
                        <Card
                          key={i}
                          className={cn(
                            "border-zinc-800",
                            i < hintsRevealed
                              ? "bg-zinc-900/50"
                              : "bg-zinc-900/20"
                          )}
                        >
                          <CardHeader className="pb-0">
                            <CardTitle className="text-xs font-medium text-zinc-500">
                              Hint {i + 1}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {i < hintsRevealed ? (
                              <p className="text-sm text-zinc-300 leading-relaxed">
                                {hint}
                              </p>
                            ) : (
                              <p className="text-sm text-zinc-600 italic">
                                Click &quot;Show Hint&quot; to reveal
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {hintsRevealed < lab.hints.length && (
                        <Button
                          onClick={handleRevealHint}
                          variant="outline"
                          size="sm"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 w-full"
                        >
                          <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                          Show Hint {hintsRevealed + 1}
                        </Button>
                      )}

                      {hintsRevealed === lab.hints.length &&
                        lab.hints.length > 0 && (
                          <p className="text-xs text-zinc-600 text-center">
                            All hints revealed
                          </p>
                        )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* ----- Right Panel: Code Editor + Terminal (40%) ----- */}
        <div className="lg:w-[40%] w-full flex flex-col min-h-0">
          {/* Code Editor */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-zinc-800">
            {/* Editor toolbar */}
            <div className="shrink-0 flex items-center justify-between border-b border-zinc-800 px-4 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">
                  {lab.type}.py
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="xs"
                  className="text-zinc-500 hover:text-zinc-300"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="ghost"
                  size="xs"
                  className="text-zinc-500 hover:text-zinc-300"
                  title="Reset to starter code"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Editor body with line numbers */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="shrink-0 bg-zinc-950 border-r border-zinc-800 overflow-hidden">
                <LineNumbers count={lineCount} />
              </div>
              <div className="flex-1 min-w-0 overflow-auto">
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  className="w-full h-full bg-zinc-950 text-zinc-200 text-sm font-mono p-4 resize-none outline-none leading-[1.625rem] placeholder:text-zinc-700"
                  placeholder="Write your code here..."
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="shrink-0 flex items-center gap-2 border-b border-zinc-800 px-4 py-2 bg-zinc-900/50">
            <Button
              onClick={handleRun}
              disabled={isRunning}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              {isRunning ? "Running..." : "Run Code"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              onClick={handleShowSolution}
              variant="outline"
              size="sm"
              className={cn(
                "text-xs ml-auto",
                showSolution
                  ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              )}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {showSolution ? "Hide Solution" : "Show Solution"}
            </Button>
          </div>

          {/* Output Terminal */}
          <div className="h-48 lg:h-56 shrink-0 flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500/60" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-xs font-medium text-zinc-500">
                  Output
                </span>
              </div>
              {executionTime !== null && executionTime > 0 && (
                <span className="text-[10px] text-zinc-600">
                  {executionTime}ms
                </span>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 font-mono text-xs leading-relaxed">
                {isRunning ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Executing code...</span>
                  </div>
                ) : output ? (
                  <div className="space-y-2">
                    {/* Status indicator */}
                    {runSuccess !== null && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-[10px] font-medium pb-2 border-b border-zinc-800 mb-2",
                          runSuccess ? "text-emerald-500" : "text-red-400"
                        )}
                      >
                        {runSuccess ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {runSuccess ? "Execution successful" : "Execution failed"}
                      </div>
                    )}
                    <pre
                      className={cn(
                        "whitespace-pre-wrap break-words",
                        runSuccess === false
                          ? "text-red-400"
                          : "text-emerald-400"
                      )}
                    >
                      {output}
                    </pre>
                  </div>
                ) : (
                  <p className="text-zinc-600">
                    Run your code to see output here...
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Solution panel (shown below terminal when active) */}
          {showSolution && solutionData && (
            <div className="shrink-0 max-h-48 border-t border-amber-500/30 bg-amber-500/5">
              <div className="px-4 py-2 border-b border-amber-500/20">
                <span className="text-xs font-medium text-amber-400">
                  Solution
                </span>
              </div>
              <ScrollArea className="h-40">
                <pre className="p-4 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {solutionData.solutionCode}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
