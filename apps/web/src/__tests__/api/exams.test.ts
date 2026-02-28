import { describe, it, expect, vi } from "vitest";
import type { ExamQuestion } from "@/lib/data/exams";

// ---------------------------------------------------------------------------
// Mock exam data — covers all 4 question types across multiple domains
// ---------------------------------------------------------------------------

const MOCK_QUESTIONS: ExamQuestion[] = [
  {
    id: "q1",
    objectiveCode: "1.1",
    type: "multiple_choice",
    question: "What is 2 + 2?",
    options: ["A) 3", "B) 4", "C) 5", "D) 6"],
    correctAnswer: "B",
    explanation: "Basic arithmetic.",
    sourceUrl: "https://example.com",
    difficulty: "easy",
    tags: ["math"],
  },
  {
    id: "q2",
    objectiveCode: "2.1",
    type: "multiple_choice",
    question: "What HTTP method retrieves data?",
    options: ["A) POST", "B) PUT", "C) GET", "D) DELETE"],
    correctAnswer: "C",
    explanation: "GET retrieves resources.",
    sourceUrl: "https://example.com",
    difficulty: "easy",
    tags: ["http"],
  },
  {
    id: "q3",
    objectiveCode: "1.2",
    type: "multiple_select",
    question: "Select the scripting languages.",
    options: ["A) Python", "B) Java", "C) Bash", "D) C++"],
    correctAnswer: ["A", "C"],
    explanation: "Python and Bash are scripting languages.",
    sourceUrl: "https://example.com",
    difficulty: "medium",
    tags: ["languages"],
  },
  {
    id: "q4",
    objectiveCode: "3.1",
    type: "fill_in_the_blank",
    question: "Complete the command: git ______",
    options: ["diff", "status", "log", "show"],
    correctAnswer: "diff",
    explanation: "git diff shows changes.",
    sourceUrl: "https://example.com",
    difficulty: "easy",
    tags: ["git"],
  },
  {
    id: "q5",
    objectiveCode: "6.1",
    type: "drag_and_drop",
    question: "Order the OSI layers top to bottom: 1. Application 2. Transport",
    options: ["A) Layer 7", "B) Layer 4"],
    correctAnswer: ["A", "B"],
    explanation: "Application is Layer 7, Transport is Layer 4.",
    sourceUrl: "https://example.com",
    difficulty: "hard",
    tags: ["networking"],
  },
];

const MOCK_EXAM = {
  examId: "test-exam",
  title: "Test Exam",
  description: "A test exam",
  totalQuestions: MOCK_QUESTIONS.length,
  timeLimit: 60,
  questions: MOCK_QUESTIONS,
};

// Mock fs and path before importing the module under test
vi.mock("fs", () => ({
  default: {
    existsSync: (p: string) => p.includes("test-exam"),
    readFileSync: () => JSON.stringify(MOCK_EXAM),
    readdirSync: () => ["test-exam.json"],
  },
  existsSync: (p: string) => p.includes("test-exam"),
  readFileSync: () => JSON.stringify(MOCK_EXAM),
  readdirSync: () => ["test-exam.json"],
}));

vi.mock("path", () => ({
  default: {
    join: (...args: string[]) => args.join("/"),
  },
  join: (...args: string[]) => args.join("/"),
}));

// Import after mocks
const { gradeExam } = await import("@/lib/data/exams");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("gradeExam", () => {
  describe("basic grading", () => {
    it("returns null for a non-existent exam", () => {
      const result = gradeExam("non-existent", {}, 120);
      expect(result).toBeNull();
    });

    it("grades a perfect score correctly", () => {
      const answers = {
        q1: "B",
        q2: "C",
        q3: ["A", "C"],
        q4: "diff",
        q5: ["A", "B"],
      };
      const result = gradeExam("test-exam", answers, 300)!;

      expect(result.score).toBe(100);
      expect(result.totalCorrect).toBe(5);
      expect(result.totalQuestions).toBe(5);
      expect(result.passed).toBe(true);
      expect(result.timeTaken).toBe(300);
    });

    it("grades a zero score when all answers are wrong", () => {
      const answers = {
        q1: "A",
        q2: "A",
        q3: ["B", "D"],
        q4: "status",
        q5: ["B", "A"],
      };
      const result = gradeExam("test-exam", answers, 600)!;

      expect(result.score).toBe(0);
      expect(result.totalCorrect).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("grades unanswered questions as incorrect", () => {
      const answers = { q1: "B" };
      const result = gradeExam("test-exam", answers, 100)!;

      expect(result.totalCorrect).toBe(1);
      expect(result.totalQuestions).toBe(5);
      expect(result.score).toBe(20);
      expect(result.passed).toBe(false);
    });

    it("grades empty answers object as zero", () => {
      const result = gradeExam("test-exam", {}, 0)!;

      expect(result.score).toBe(0);
      expect(result.totalCorrect).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe("pass/fail threshold (70%)", () => {
    it("passes at 80% (4/5)", () => {
      const answers = {
        q1: "B",
        q2: "C",
        q3: ["A", "C"],
        q4: "diff",
        q5: ["B", "A"], // wrong
      };
      const result = gradeExam("test-exam", answers, 300)!;

      expect(result.score).toBe(80);
      expect(result.passed).toBe(true);
    });

    it("fails at 60% (3/5)", () => {
      const answers = {
        q1: "B",
        q2: "C",
        q3: ["A", "C"],
        q4: "wrong",
        q5: ["B", "A"], // wrong
      };
      const result = gradeExam("test-exam", answers, 300)!;

      expect(result.score).toBe(60);
      expect(result.passed).toBe(false);
    });
  });

  describe("multiple choice grading", () => {
    it("accepts correct answer", () => {
      const result = gradeExam("test-exam", { q1: "B" }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;
      expect(q1.correct).toBe(true);
    });

    it("rejects wrong answer", () => {
      const result = gradeExam("test-exam", { q1: "A" }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;
      expect(q1.correct).toBe(false);
    });

    it("is case-insensitive", () => {
      const result = gradeExam("test-exam", { q1: "b" }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;
      expect(q1.correct).toBe(true);
    });

    it("trims whitespace", () => {
      const result = gradeExam("test-exam", { q1: "  B  " }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;
      expect(q1.correct).toBe(true);
    });

    it("rejects array for multiple choice", () => {
      const result = gradeExam("test-exam", { q1: ["B"] as unknown as string }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;
      expect(q1.correct).toBe(false);
    });
  });

  describe("multiple select grading", () => {
    it("accepts correct answers in same order", () => {
      const result = gradeExam("test-exam", { q3: ["A", "C"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(true);
    });

    it("accepts correct answers in different order", () => {
      const result = gradeExam("test-exam", { q3: ["C", "A"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(true);
    });

    it("is case-insensitive", () => {
      const result = gradeExam("test-exam", { q3: ["a", "c"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(true);
    });

    it("rejects partial answers (too few)", () => {
      const result = gradeExam("test-exam", { q3: ["A"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(false);
    });

    it("rejects answers with extra selections", () => {
      const result = gradeExam("test-exam", { q3: ["A", "B", "C"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(false);
    });

    it("rejects wrong selections", () => {
      const result = gradeExam("test-exam", { q3: ["B", "D"] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(false);
    });

    it("rejects string answer for multiple select", () => {
      const result = gradeExam("test-exam", { q3: "A" as unknown as string[] }, 60)!;
      const q3 = result.questionResults.find((q) => q.questionId === "q3")!;
      expect(q3.correct).toBe(false);
    });
  });

  describe("fill in the blank grading", () => {
    it("accepts exact match", () => {
      const result = gradeExam("test-exam", { q4: "diff" }, 60)!;
      const q4 = result.questionResults.find((q) => q.questionId === "q4")!;
      expect(q4.correct).toBe(true);
    });

    it("is case-insensitive", () => {
      const result = gradeExam("test-exam", { q4: "DIFF" }, 60)!;
      const q4 = result.questionResults.find((q) => q.questionId === "q4")!;
      expect(q4.correct).toBe(true);
    });

    it("trims whitespace", () => {
      const result = gradeExam("test-exam", { q4: "  diff  " }, 60)!;
      const q4 = result.questionResults.find((q) => q.questionId === "q4")!;
      expect(q4.correct).toBe(true);
    });

    it("rejects wrong answer", () => {
      const result = gradeExam("test-exam", { q4: "status" }, 60)!;
      const q4 = result.questionResults.find((q) => q.questionId === "q4")!;
      expect(q4.correct).toBe(false);
    });
  });

  describe("drag and drop grading", () => {
    it("accepts correct order", () => {
      const result = gradeExam("test-exam", { q5: ["A", "B"] }, 60)!;
      const q5 = result.questionResults.find((q) => q.questionId === "q5")!;
      expect(q5.correct).toBe(true);
    });

    it("rejects wrong order (order matters)", () => {
      const result = gradeExam("test-exam", { q5: ["B", "A"] }, 60)!;
      const q5 = result.questionResults.find((q) => q.questionId === "q5")!;
      expect(q5.correct).toBe(false);
    });

    it("is case-insensitive", () => {
      const result = gradeExam("test-exam", { q5: ["a", "b"] }, 60)!;
      const q5 = result.questionResults.find((q) => q.questionId === "q5")!;
      expect(q5.correct).toBe(true);
    });

    it("rejects wrong length", () => {
      const result = gradeExam("test-exam", { q5: ["A"] }, 60)!;
      const q5 = result.questionResults.find((q) => q.questionId === "q5")!;
      expect(q5.correct).toBe(false);
    });

    it("rejects string answer for drag and drop", () => {
      const result = gradeExam("test-exam", { q5: "A" as unknown as string[] }, 60)!;
      const q5 = result.questionResults.find((q) => q.questionId === "q5")!;
      expect(q5.correct).toBe(false);
    });
  });

  describe("question results", () => {
    it("returns results for every question", () => {
      const result = gradeExam("test-exam", { q1: "B" }, 60)!;
      expect(result.questionResults).toHaveLength(5);
    });

    it("includes question text, user answer, correct answer, and explanation", () => {
      const result = gradeExam("test-exam", { q1: "A" }, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;

      expect(q1.text).toBe("What is 2 + 2?");
      expect(q1.userAnswer).toBe("A");
      expect(q1.correctAnswer).toBe("B");
      expect(q1.explanation).toBe("Basic arithmetic.");
      expect(q1.correct).toBe(false);
    });

    it("sets userAnswer to null for unanswered questions", () => {
      const result = gradeExam("test-exam", {}, 60)!;
      const q1 = result.questionResults.find((q) => q.questionId === "q1")!;

      expect(q1.userAnswer).toBeNull();
      expect(q1.correct).toBe(false);
    });
  });

  describe("domain breakdown", () => {
    it("groups scores by domain", () => {
      const answers = {
        q1: "B",          // domain 1 - correct
        q2: "A",          // domain 2 - wrong
        q3: ["A", "C"],   // domain 1 - correct
        q4: "diff",       // domain 3 - correct
        q5: ["A", "B"],   // domain 6 - correct
      };
      const result = gradeExam("test-exam", answers, 300)!;

      const domain1 = result.domainBreakdown.find((d) => d.domain.includes("Software"))!;
      const domain2 = result.domainBreakdown.find((d) => d.domain.includes("APIs"))!;
      const domain3 = result.domainBreakdown.find((d) => d.domain.includes("Cisco"))!;
      const domain6 = result.domainBreakdown.find((d) => d.domain.includes("Network"))!;

      expect(domain1.correct).toBe(2);
      expect(domain1.total).toBe(2);
      expect(domain1.percentage).toBe(100);

      expect(domain2.correct).toBe(0);
      expect(domain2.total).toBe(1);
      expect(domain2.percentage).toBe(0);

      expect(domain3.correct).toBe(1);
      expect(domain3.total).toBe(1);
      expect(domain3.percentage).toBe(100);

      expect(domain6.correct).toBe(1);
      expect(domain6.total).toBe(1);
      expect(domain6.percentage).toBe(100);
    });

    it("includes human-readable domain labels", () => {
      const result = gradeExam("test-exam", { q1: "B" }, 60)!;
      const domainNames = result.domainBreakdown.map((d) => d.domain);

      expect(domainNames).toContain("Software Development & Design");
    });
  });

  describe("domain filtering", () => {
    it("only grades questions for the specified domain", () => {
      const result = gradeExam("test-exam", { q1: "B", q3: ["A", "C"] }, 60, "software-dev")!;

      expect(result.totalQuestions).toBe(2);
      expect(result.totalCorrect).toBe(2);
      expect(result.score).toBe(100);
    });

    it("ignores answers for questions outside the domain", () => {
      const result = gradeExam(
        "test-exam",
        { q1: "B", q2: "C", q3: ["A", "C"], q4: "diff", q5: ["A", "B"] },
        60,
        "apis",
      )!;

      expect(result.totalQuestions).toBe(1);
      expect(result.totalCorrect).toBe(1);
      expect(result.score).toBe(100);
    });

    it("returns zero score when no answers match the domain", () => {
      const result = gradeExam("test-exam", {}, 60, "network-fundamentals")!;

      expect(result.totalQuestions).toBe(1);
      expect(result.totalCorrect).toBe(0);
      expect(result.score).toBe(0);
    });
  });

  describe("score calculation", () => {
    it("calculates percentage correctly", () => {
      const result = gradeExam("test-exam", { q1: "B", q2: "C" }, 60)!;
      expect(result.score).toBe(40);
    });

    it("preserves timeTaken in the result", () => {
      const result = gradeExam("test-exam", {}, 1234)!;
      expect(result.timeTaken).toBe(1234);
    });
  });
});
