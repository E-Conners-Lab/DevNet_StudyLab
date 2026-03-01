import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock the DB layer — we test that the progress functions handle
// null users, DB unavailability, and correct data shapes.
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Chainable query builder mock
function makeChainable(resultFn: () => unknown) {
  const chain: Record<string | symbol, unknown> = {};
  const methods = [
    "select", "from", "where", "orderBy", "limit", "innerJoin",
    "groupBy", "values", "set", "returning",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal: make the chain itself thenable so `await db.select()...` resolves
  chain[Symbol.iterator] = undefined;
  chain.then = (resolve: (v: unknown) => void) => resolve(resultFn());
  return chain;
}

let dbConfigured = true;

vi.mock("@/lib/db", () => ({
  isDbConfigured: () => dbConfigured,
  getDb: () => ({
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return makeChainable(() => []);
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return makeChainable(() => [{ id: "mock-id" }]);
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return makeChainable(() => []);
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return makeChainable(() => []);
    },
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  flashcardProgress: { id: "id", userId: "userId", flashcardId: "flashcardId", ease: "ease", interval: "interval", repetitions: "repetitions", nextReview: "nextReview", lastReview: "lastReview" },
  practiceAttempts: { id: "id", userId: "userId", score: "score", totalQuestions: "totalQuestions", domainFilter: "domainFilter", startedAt: "startedAt", completedAt: "completedAt" },
  practiceAnswers: { attemptId: "attemptId", questionId: "questionId", userAnswer: "userAnswer", isCorrect: "isCorrect", timeSpent: "timeSpent" },
  labAttempts: { id: "id", userId: "userId", labId: "labId", status: "status", startedAt: "startedAt", completedAt: "completedAt", userCode: "userCode" },
  labs: { id: "id", slug: "slug" },
  studyProgress: { id: "id", userId: "userId", domainId: "domainId", objectiveId: "objectiveId", completedAt: "completedAt" },
  objectives: { id: "id", code: "code", domainId: "domainId" },
  flashcards: { id: "id", objectiveId: "objectiveId" },
  domains: { id: "id" },
}));

const {
  getFlashcardProgress,
  upsertFlashcardProgress,
  getExamAttempts,
  saveExamAttempt,
  getLabAttempts,
  saveLabAttempt,
  getStudyProgress,
  saveStudyObjective,
} = await import("@/lib/data/progress");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  dbConfigured = true;
});

describe("progress functions — null userId handling", () => {
  it("getFlashcardProgress returns empty object for null user", async () => {
    const result = await getFlashcardProgress(null);
    expect(result).toEqual({});
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("upsertFlashcardProgress is a no-op for null user", async () => {
    await upsertFlashcardProgress(null, {
      flashcardId: "fc-1",
      ease: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: new Date().toISOString(),
      lastReview: new Date().toISOString(),
    });
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getExamAttempts returns empty array for null user", async () => {
    const result = await getExamAttempts(null);
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("saveExamAttempt returns null for null user", async () => {
    const result = await saveExamAttempt(null, {
      score: 85,
      totalQuestions: 40,
      timeTakenSeconds: 1800,
      answers: [],
    });
    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getLabAttempts returns empty object for null user", async () => {
    const result = await getLabAttempts(null);
    expect(result).toEqual({});
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("saveLabAttempt is a no-op for null user", async () => {
    await saveLabAttempt(null, "python-data-parsing", "completed");
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getStudyProgress returns empty array for null user", async () => {
    const result = await getStudyProgress(null);
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("saveStudyObjective is a no-op for null user", async () => {
    await saveStudyObjective(null, "1.1", true);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("progress functions — DB unavailable", () => {
  beforeEach(() => {
    dbConfigured = false;
  });

  it("getFlashcardProgress returns empty when DB is not configured", async () => {
    const result = await getFlashcardProgress("user-1");
    expect(result).toEqual({});
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("getExamAttempts returns empty when DB is not configured", async () => {
    const result = await getExamAttempts("user-1");
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("saveExamAttempt returns null when DB is not configured", async () => {
    const result = await saveExamAttempt("user-1", {
      score: 75,
      totalQuestions: 40,
      timeTakenSeconds: 1200,
      answers: [{ questionId: "q1", userAnswer: "B", isCorrect: true }],
    });
    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getLabAttempts returns empty when DB is not configured", async () => {
    const result = await getLabAttempts("user-1");
    expect(result).toEqual({});
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("getStudyProgress returns empty when DB is not configured", async () => {
    const result = await getStudyProgress("user-1");
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("saveStudyObjective is a no-op when DB is not configured", async () => {
    await saveStudyObjective("user-1", "2.1", true);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("progress functions — DB available with valid user", () => {
  it("getFlashcardProgress queries the DB for the user", async () => {
    await getFlashcardProgress("user-1");
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getExamAttempts queries the DB for the user", async () => {
    await getExamAttempts("user-1");
    expect(mockSelect).toHaveBeenCalled();
  });

  it("saveExamAttempt inserts into the DB", async () => {
    await saveExamAttempt("user-1", {
      score: 80,
      totalQuestions: 40,
      timeTakenSeconds: 2400,
      answers: [
        { questionId: "q1", userAnswer: "B", isCorrect: true },
        { questionId: "q2", userAnswer: "A", isCorrect: false },
      ],
    });
    // Should insert both the attempt and the answers
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("saveExamAttempt skips answer insert when answers array is empty", async () => {
    await saveExamAttempt("user-1", {
      score: 0,
      totalQuestions: 40,
      timeTakenSeconds: 0,
      answers: [],
    });
    // Only the attempt insert, no answers insert
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("getLabAttempts queries the DB for the user", async () => {
    await getLabAttempts("user-1");
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getStudyProgress queries the DB for the user", async () => {
    await getStudyProgress("user-1");
    expect(mockSelect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Grade API route integration test
// ---------------------------------------------------------------------------

describe("POST /api/exams/[examId]/grade — route integration", () => {
  // Mock dependencies for the route
  vi.mock("@/lib/auth-helpers", () => ({
    getCurrentUserId: vi.fn().mockResolvedValue("test-user"),
  }));

  vi.mock("@/lib/data", async () => {
    const mockGradeResult = {
      score: 75,
      totalQuestions: 4,
      totalCorrect: 3,
      passed: true,
      timeTaken: 600,
      questionResults: [
        {
          questionId: "q1",
          text: "Question 1",
          correct: true,
          userAnswer: "B",
          correctAnswer: "B",
          explanation: "Correct!",
        },
        {
          questionId: "q2",
          text: "Question 2",
          correct: true,
          userAnswer: "C",
          correctAnswer: "C",
          explanation: "Right!",
        },
        {
          questionId: "q3",
          text: "Question 3",
          correct: true,
          userAnswer: ["A", "C"],
          correctAnswer: ["A", "C"],
          explanation: "Both correct!",
        },
        {
          questionId: "q4",
          text: "Question 4",
          correct: false,
          userAnswer: "wrong",
          correctAnswer: "diff",
          explanation: "It was diff.",
        },
      ],
      domainBreakdown: [
        { domain: "Software Development & Design", correct: 2, total: 2, percentage: 100 },
        { domain: "Understanding & Using APIs", correct: 1, total: 1, percentage: 100 },
        { domain: "Cisco Platforms & Development", correct: 0, total: 1, percentage: 0 },
      ],
    };

    return {
      gradeExam: vi.fn().mockReturnValue(mockGradeResult),
      saveExamAttempt: vi.fn().mockResolvedValue("attempt-123"),
      getExamAttempts: vi.fn().mockResolvedValue([]),
    };
  });

  it("returns correct response shape with all required fields", async () => {
    const { POST } = await import("@/app/api/exams/[examId]/grade/route");

    const request = new NextRequest("http://localhost:3000/api/exams/test-exam/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: { q1: "B", q2: "C", q3: ["A", "C"], q4: "wrong" },
        timeTaken: 600,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ examId: "test-exam" }),
    });
    const data = await response.json();

    // Verify top-level fields
    expect(data).toHaveProperty("score");
    expect(data).toHaveProperty("totalQuestions");
    expect(data).toHaveProperty("totalCorrect");
    expect(data).toHaveProperty("passed");
    expect(data).toHaveProperty("timeTaken");
    expect(data).toHaveProperty("questionResults");
    expect(data).toHaveProperty("domainBreakdown");

    expect(typeof data.score).toBe("number");
    expect(typeof data.passed).toBe("boolean");
    expect(Array.isArray(data.questionResults)).toBe(true);
    expect(Array.isArray(data.domainBreakdown)).toBe(true);
  });

  it("question results contain all fields the UI needs", async () => {
    const { POST } = await import("@/app/api/exams/[examId]/grade/route");

    const request = new NextRequest("http://localhost:3000/api/exams/test-exam/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: { q1: "B" },
        timeTaken: 120,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ examId: "test-exam" }),
    });
    const data = await response.json();

    const qr = data.questionResults[0];
    expect(qr).toHaveProperty("questionId");
    expect(qr).toHaveProperty("text");
    expect(qr).toHaveProperty("correct");
    expect(qr).toHaveProperty("userAnswer");
    expect(qr).toHaveProperty("correctAnswer");
    expect(qr).toHaveProperty("explanation");
  });

  it("domain breakdown contains all fields the UI needs", async () => {
    const { POST } = await import("@/app/api/exams/[examId]/grade/route");

    const request = new NextRequest("http://localhost:3000/api/exams/test-exam/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: { q1: "B" },
        timeTaken: 120,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ examId: "test-exam" }),
    });
    const data = await response.json();

    const domain = data.domainBreakdown[0];
    expect(domain).toHaveProperty("domain");
    expect(domain).toHaveProperty("correct");
    expect(domain).toHaveProperty("total");
    expect(domain).toHaveProperty("percentage");
    expect(typeof domain.domain).toBe("string");
    expect(typeof domain.percentage).toBe("number");
  });

  it("returns 400 when answers object is missing", async () => {
    const { POST } = await import("@/app/api/exams/[examId]/grade/route");

    const request = new NextRequest("http://localhost:3000/api/exams/test-exam/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeTaken: 120 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ examId: "test-exam" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("answers");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/exams/[examId]/grade/route");

    const request = new NextRequest("http://localhost:3000/api/exams/test-exam/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request, {
      params: Promise.resolve({ examId: "test-exam" }),
    });

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/exams/attempts — route integration
// ---------------------------------------------------------------------------

describe("GET /api/exams/attempts — route integration", () => {
  it("returns { attempts: [] } shape", async () => {
    const { GET } = await import("@/app/api/exams/attempts/route");

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("attempts");
    expect(Array.isArray(data.attempts)).toBe(true);
  });
});
