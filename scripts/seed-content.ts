#!/usr/bin/env npx tsx

/**
 * CCNA Automation Study Prep Content Seeding & Validation Script
 *
 * Reads the exam blueprint, flashcard files, and practice exam files,
 * validates their structure and content, and generates a coverage matrix.
 *
 * Usage: npx tsx scripts/seed-content.ts
 *
 * Does NOT require a database connection -- operates purely on local JSON files.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Type Definitions ────────────────────────────────────────────────────────

interface Objective {
  code: string;
  title: string;
  subobjectives?: string[];
}

interface Domain {
  number: number;
  slug: string;
  name: string;
  weight: number;
  objectives: Objective[];
}

interface ExamBlueprint {
  examCode: string;
  examName: string;
  duration: number;
  domains: Domain[];
}

interface Flashcard {
  id: string;
  objectiveCode: string;
  question: string;
  answer: string;
  explanation: string;
  sourceUrl: string;
  difficulty: string;
  tags: string[];
}

interface FlashcardFile {
  domain: number;
  domainName: string;
  flashcards: Flashcard[];
}

interface ExamQuestion {
  id: string;
  objectiveCode: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  sourceUrl: string;
  difficulty: string;
  tags: string[];
}

interface PracticeExam {
  examId: string;
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number;
  questions: ExamQuestion[];
}

interface CoverageEntry {
  objectiveCode: string;
  objectiveTitle: string;
  domainNumber: number;
  flashcardCount: number;
  flashcardIds: string[];
  questionCount: number;
  questionIds: string[];
  covered: boolean;
}

interface ValidationError {
  file: string;
  itemId?: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTENT_DIR = path.resolve(__dirname, "..", "content");
const BLUEPRINT_PATH = path.join(CONTENT_DIR, "exam-blueprint.json");
const FLASHCARDS_DIR = path.join(CONTENT_DIR, "flashcards");
const EXAMS_DIR = path.join(CONTENT_DIR, "practice-exams");
const COVERAGE_OUTPUT = path.join(CONTENT_DIR, "coverage-matrix.json");

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_QUESTION_TYPES = [
  "multiple_choice",
  "multiple_select",
  "drag_drop",
  "fill_blank",
];
const URL_PATTERN = /^https?:\/\/.+/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function getFlashcardFiles(): string[] {
  if (!fs.existsSync(FLASHCARDS_DIR)) return [];
  return fs
    .readdirSync(FLASHCARDS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(FLASHCARDS_DIR, f))
    .sort();
}

function getExamFiles(): string[] {
  if (!fs.existsSync(EXAMS_DIR)) return [];
  return fs
    .readdirSync(EXAMS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(EXAMS_DIR, f))
    .sort();
}

// ─── Validators ──────────────────────────────────────────────────────────────

function validateBlueprint(blueprint: ExamBlueprint): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = "exam-blueprint.json";

  if (!blueprint.examCode) {
    errors.push({
      file,
      field: "examCode",
      message: "Missing examCode",
      severity: "error",
    });
  }
  if (!blueprint.examName) {
    errors.push({
      file,
      field: "examName",
      message: "Missing examName",
      severity: "error",
    });
  }
  if (!blueprint.duration || blueprint.duration <= 0) {
    errors.push({
      file,
      field: "duration",
      message: "Duration must be a positive number",
      severity: "error",
    });
  }
  if (!blueprint.domains || blueprint.domains.length === 0) {
    errors.push({
      file,
      field: "domains",
      message: "No domains defined",
      severity: "error",
    });
  }

  const totalWeight = blueprint.domains.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight !== 100) {
    errors.push({
      file,
      field: "domains.weight",
      message: `Domain weights sum to ${totalWeight}, expected 100`,
      severity: "warning",
    });
  }

  for (const domain of blueprint.domains) {
    if (!domain.name) {
      errors.push({
        file,
        field: `domain[${domain.number}].name`,
        message: "Domain missing name",
        severity: "error",
      });
    }
    if (!domain.slug) {
      errors.push({
        file,
        field: `domain[${domain.number}].slug`,
        message: "Domain missing slug",
        severity: "error",
      });
    }
    if (!domain.objectives || domain.objectives.length === 0) {
      errors.push({
        file,
        field: `domain[${domain.number}].objectives`,
        message: "Domain has no objectives",
        severity: "error",
      });
    }
    for (const obj of domain.objectives) {
      if (!obj.code) {
        errors.push({
          file,
          field: `domain[${domain.number}].objective`,
          message: "Objective missing code",
          severity: "error",
        });
      }
      if (!obj.title) {
        errors.push({
          file,
          itemId: obj.code,
          field: "title",
          message: `Objective ${obj.code} missing title`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}

function validateFlashcard(
  card: Flashcard,
  fileName: string,
  validObjectives: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = path.basename(fileName);

  if (!card.id) {
    errors.push({
      file,
      field: "id",
      message: "Flashcard missing id",
      severity: "error",
    });
  }
  if (!card.objectiveCode) {
    errors.push({
      file,
      itemId: card.id,
      field: "objectiveCode",
      message: "Flashcard missing objectiveCode",
      severity: "error",
    });
  } else if (!validObjectives.has(card.objectiveCode)) {
    errors.push({
      file,
      itemId: card.id,
      field: "objectiveCode",
      message: `Objective code '${card.objectiveCode}' not found in blueprint`,
      severity: "error",
    });
  }
  if (!card.question || card.question.trim().length === 0) {
    errors.push({
      file,
      itemId: card.id,
      field: "question",
      message: "Flashcard has empty question",
      severity: "error",
    });
  }
  if (!card.answer || card.answer.trim().length === 0) {
    errors.push({
      file,
      itemId: card.id,
      field: "answer",
      message: "Flashcard has empty answer",
      severity: "error",
    });
  }
  if (!card.explanation || card.explanation.trim().length === 0) {
    errors.push({
      file,
      itemId: card.id,
      field: "explanation",
      message: "Flashcard has empty explanation",
      severity: "error",
    });
  }
  if (!card.sourceUrl || !URL_PATTERN.test(card.sourceUrl)) {
    errors.push({
      file,
      itemId: card.id,
      field: "sourceUrl",
      message: `Invalid or missing sourceUrl: '${card.sourceUrl || ""}'`,
      severity: "warning",
    });
  }
  if (!card.difficulty || !VALID_DIFFICULTIES.includes(card.difficulty)) {
    errors.push({
      file,
      itemId: card.id,
      field: "difficulty",
      message: `Invalid difficulty '${card.difficulty}'; expected one of: ${VALID_DIFFICULTIES.join(", ")}`,
      severity: "error",
    });
  }
  if (!card.tags || !Array.isArray(card.tags) || card.tags.length === 0) {
    errors.push({
      file,
      itemId: card.id,
      field: "tags",
      message: "Flashcard missing tags array",
      severity: "warning",
    });
  }

  return errors;
}

function validateExamQuestion(
  q: ExamQuestion,
  fileName: string,
  validObjectives: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = path.basename(fileName);

  if (!q.id) {
    errors.push({
      file,
      field: "id",
      message: "Question missing id",
      severity: "error",
    });
  }
  if (!q.objectiveCode) {
    errors.push({
      file,
      itemId: q.id,
      field: "objectiveCode",
      message: "Question missing objectiveCode",
      severity: "error",
    });
  } else if (!validObjectives.has(q.objectiveCode)) {
    errors.push({
      file,
      itemId: q.id,
      field: "objectiveCode",
      message: `Objective code '${q.objectiveCode}' not found in blueprint`,
      severity: "error",
    });
  }
  if (!q.type || !VALID_QUESTION_TYPES.includes(q.type)) {
    errors.push({
      file,
      itemId: q.id,
      field: "type",
      message: `Invalid question type '${q.type}'; expected one of: ${VALID_QUESTION_TYPES.join(", ")}`,
      severity: "error",
    });
  }
  if (!q.question || q.question.trim().length === 0) {
    errors.push({
      file,
      itemId: q.id,
      field: "question",
      message: "Question has empty question text",
      severity: "error",
    });
  }
  if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
    errors.push({
      file,
      itemId: q.id,
      field: "options",
      message: "Question must have at least 2 options",
      severity: "error",
    });
  }
  if (
    q.correctAnswer === undefined ||
    q.correctAnswer === null ||
    (typeof q.correctAnswer === "string" && q.correctAnswer.trim().length === 0)
  ) {
    errors.push({
      file,
      itemId: q.id,
      field: "correctAnswer",
      message: "Question has empty correctAnswer",
      severity: "error",
    });
  }
  if (
    Array.isArray(q.correctAnswer) &&
    (q.type === "multiple_select" || q.type === "drag_drop")
  ) {
    if (q.correctAnswer.length === 0) {
      errors.push({
        file,
        itemId: q.id,
        field: "correctAnswer",
        message: "Multiple select/drag-drop question has empty correctAnswer array",
        severity: "error",
      });
    }
  }
  if (!q.explanation || q.explanation.trim().length === 0) {
    errors.push({
      file,
      itemId: q.id,
      field: "explanation",
      message: "Question has empty explanation",
      severity: "error",
    });
  }
  if (!q.sourceUrl || !URL_PATTERN.test(q.sourceUrl)) {
    errors.push({
      file,
      itemId: q.id,
      field: "sourceUrl",
      message: `Invalid or missing sourceUrl: '${q.sourceUrl || ""}'`,
      severity: "warning",
    });
  }
  if (!q.difficulty || !VALID_DIFFICULTIES.includes(q.difficulty)) {
    errors.push({
      file,
      itemId: q.id,
      field: "difficulty",
      message: `Invalid difficulty '${q.difficulty}'`,
      severity: "error",
    });
  }
  if (!q.tags || !Array.isArray(q.tags) || q.tags.length === 0) {
    errors.push({
      file,
      itemId: q.id,
      field: "tags",
      message: "Question missing tags",
      severity: "warning",
    });
  }

  return errors;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("=".repeat(70));
  console.log("  CCNA Automation Study Prep Content Seeding & Validation");
  console.log("  Cisco DevNet Associate (200-901) Exam Blueprint");
  console.log("=".repeat(70));
  console.log();

  // ── 1. Load and validate blueprint ──

  if (!fs.existsSync(BLUEPRINT_PATH)) {
    console.error(`ERROR: Blueprint file not found at ${BLUEPRINT_PATH}`);
    process.exit(1);
  }

  const blueprint = readJsonFile<ExamBlueprint>(BLUEPRINT_PATH);
  const blueprintErrors = validateBlueprint(blueprint);

  const allObjectiveCodes = new Set<string>();
  const objectiveMap = new Map<string, { title: string; domain: number }>();

  for (const domain of blueprint.domains) {
    for (const obj of domain.objectives) {
      allObjectiveCodes.add(obj.code);
      objectiveMap.set(obj.code, {
        title: obj.title,
        domain: domain.number,
      });
    }
  }

  console.log(`[Blueprint] ${blueprint.examCode} - ${blueprint.examName}`);
  console.log(`[Blueprint] Duration: ${blueprint.duration} minutes`);
  console.log(`[Blueprint] Domains: ${blueprint.domains.length}`);
  console.log(
    `[Blueprint] Total objectives: ${allObjectiveCodes.size}`
  );
  console.log();

  for (const domain of blueprint.domains) {
    console.log(
      `  Domain ${domain.number}: ${domain.name} (${domain.weight}%) - ${domain.objectives.length} objectives`
    );
  }
  console.log();

  // ── 2. Load and validate flashcards ──

  const flashcardFiles = getFlashcardFiles();
  const allFlashcards: Flashcard[] = [];
  const flashcardsByDomain = new Map<number, number>();
  const flashcardsByObjective = new Map<string, string[]>();
  let flashcardErrors: ValidationError[] = [];

  console.log(`[Flashcards] Found ${flashcardFiles.length} flashcard file(s)`);

  for (const filePath of flashcardFiles) {
    const data = readJsonFile<FlashcardFile>(filePath);
    const fileName = path.basename(filePath);

    console.log(
      `  ${fileName}: Domain ${data.domain} - ${data.flashcards.length} cards`
    );

    flashcardsByDomain.set(
      data.domain,
      (flashcardsByDomain.get(data.domain) || 0) + data.flashcards.length
    );

    for (const card of data.flashcards) {
      allFlashcards.push(card);
      const cardErrors = validateFlashcard(card, filePath, allObjectiveCodes);
      flashcardErrors = flashcardErrors.concat(cardErrors);

      if (!flashcardsByObjective.has(card.objectiveCode)) {
        flashcardsByObjective.set(card.objectiveCode, []);
      }
      flashcardsByObjective.get(card.objectiveCode)!.push(card.id);
    }
  }

  console.log(`  Total flashcards: ${allFlashcards.length}`);
  console.log();

  // Check for duplicate flashcard IDs
  const flashcardIds = new Set<string>();
  for (const card of allFlashcards) {
    if (flashcardIds.has(card.id)) {
      flashcardErrors.push({
        file: "flashcards",
        itemId: card.id,
        field: "id",
        message: `Duplicate flashcard ID: ${card.id}`,
        severity: "error",
      });
    }
    flashcardIds.add(card.id);
  }

  // ── 3. Load and validate practice exams ──

  const examFiles = getExamFiles();
  const allQuestions: ExamQuestion[] = [];
  const questionsByDomain = new Map<number, number>();
  const questionsByObjective = new Map<string, string[]>();
  let examErrors: ValidationError[] = [];

  console.log(`[Practice Exams] Found ${examFiles.length} exam file(s)`);

  for (const filePath of examFiles) {
    const exam = readJsonFile<PracticeExam>(filePath);
    const fileName = path.basename(filePath);

    console.log(
      `  ${fileName}: "${exam.title}" - ${exam.questions.length} questions`
    );

    if (exam.totalQuestions !== exam.questions.length) {
      examErrors.push({
        file: fileName,
        field: "totalQuestions",
        message: `totalQuestions (${exam.totalQuestions}) does not match actual question count (${exam.questions.length})`,
        severity: "warning",
      });
    }

    // Check question type distribution
    const typeCounts = new Map<string, number>();
    for (const q of exam.questions) {
      typeCounts.set(q.type, (typeCounts.get(q.type) || 0) + 1);
    }
    const typeStr = Array.from(typeCounts.entries())
      .map(([t, c]) => `${t}: ${c}`)
      .join(", ");
    console.log(`    Question types: ${typeStr}`);

    for (const q of exam.questions) {
      allQuestions.push(q);
      const qErrors = validateExamQuestion(q, filePath, allObjectiveCodes);
      examErrors = examErrors.concat(qErrors);

      const domainNum = objectiveMap.get(q.objectiveCode)?.domain;
      if (domainNum) {
        questionsByDomain.set(
          domainNum,
          (questionsByDomain.get(domainNum) || 0) + 1
        );
      }

      if (!questionsByObjective.has(q.objectiveCode)) {
        questionsByObjective.set(q.objectiveCode, []);
      }
      questionsByObjective.get(q.objectiveCode)!.push(q.id);
    }
  }

  console.log(`  Total questions: ${allQuestions.length}`);
  console.log();

  // Check for duplicate question IDs
  const questionIds = new Set<string>();
  for (const q of allQuestions) {
    if (questionIds.has(q.id)) {
      examErrors.push({
        file: "practice-exams",
        itemId: q.id,
        field: "id",
        message: `Duplicate question ID: ${q.id}`,
        severity: "error",
      });
    }
    questionIds.add(q.id);
  }

  // ── 4. Generate coverage matrix ──

  const coverageMatrix: CoverageEntry[] = [];
  const uncoveredObjectives: string[] = [];

  for (const [code, info] of objectiveMap.entries()) {
    const fcIds = flashcardsByObjective.get(code) || [];
    const qIds = questionsByObjective.get(code) || [];
    const covered = fcIds.length > 0 || qIds.length > 0;

    if (!covered) {
      uncoveredObjectives.push(code);
    }

    coverageMatrix.push({
      objectiveCode: code,
      objectiveTitle: info.title,
      domainNumber: info.domain,
      flashcardCount: fcIds.length,
      flashcardIds: fcIds,
      questionCount: qIds.length,
      questionIds: qIds,
      covered,
    });
  }

  // Sort by objective code
  coverageMatrix.sort((a, b) => {
    const [aMaj, aMin] = a.objectiveCode.split(".").map(Number);
    const [bMaj, bMin] = b.objectiveCode.split(".").map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  // Write coverage matrix
  const coverageOutput = {
    generatedAt: new Date().toISOString(),
    examCode: blueprint.examCode,
    totalObjectives: allObjectiveCodes.size,
    coveredObjectives: allObjectiveCodes.size - uncoveredObjectives.length,
    coveragePercent: Math.round(
      ((allObjectiveCodes.size - uncoveredObjectives.length) /
        allObjectiveCodes.size) *
        100
    ),
    totalFlashcards: allFlashcards.length,
    totalQuestions: allQuestions.length,
    matrix: coverageMatrix,
  };

  fs.writeFileSync(COVERAGE_OUTPUT, JSON.stringify(coverageOutput, null, 2));
  console.log(`[Coverage] Written to ${path.relative(process.cwd(), COVERAGE_OUTPUT)}`);
  console.log();

  // ── 5. Print validation report ──

  const allErrors = [...blueprintErrors, ...flashcardErrors, ...examErrors];
  const errorCount = allErrors.filter((e) => e.severity === "error").length;
  const warningCount = allErrors.filter((e) => e.severity === "warning").length;

  console.log("=".repeat(70));
  console.log("  VALIDATION REPORT");
  console.log("=".repeat(70));
  console.log();

  // Per-domain summary
  console.log("--- Content Per Domain ---");
  console.log(
    "Domain | Name                                 | Wt  | Cards | Qs"
  );
  console.log("-".repeat(70));
  for (const domain of blueprint.domains) {
    const fcCount = flashcardsByDomain.get(domain.number) || 0;
    const qCount = questionsByDomain.get(domain.number) || 0;
    const name = domain.name.padEnd(37).substring(0, 37);
    console.log(
      `  ${domain.number}    | ${name} | ${String(domain.weight).padStart(2)}% | ${String(fcCount).padStart(5)} | ${String(qCount).padStart(3)}`
    );
  }
  console.log();

  // Coverage gaps
  console.log("--- Objective Coverage ---");
  console.log(
    `Covered: ${coverageOutput.coveredObjectives}/${coverageOutput.totalObjectives} objectives (${coverageOutput.coveragePercent}%)`
  );
  if (uncoveredObjectives.length > 0) {
    console.log();
    console.log("  UNCOVERED OBJECTIVES (no flashcards or questions):");
    for (const code of uncoveredObjectives) {
      const info = objectiveMap.get(code)!;
      console.log(
        `    [!] ${code}: ${info.title.substring(0, 60)}`
      );
    }
  } else {
    console.log("  All objectives have at least one flashcard or question.");
  }
  console.log();

  // Difficulty distribution
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  for (const card of allFlashcards) {
    if (card.difficulty in diffCounts) {
      diffCounts[card.difficulty as keyof typeof diffCounts]++;
    }
  }
  for (const q of allQuestions) {
    if (q.difficulty in diffCounts) {
      diffCounts[q.difficulty as keyof typeof diffCounts]++;
    }
  }
  const totalItems = allFlashcards.length + allQuestions.length;
  console.log("--- Difficulty Distribution (all content) ---");
  console.log(
    `  Easy:   ${diffCounts.easy} (${Math.round((diffCounts.easy / totalItems) * 100)}%)`
  );
  console.log(
    `  Medium: ${diffCounts.medium} (${Math.round((diffCounts.medium / totalItems) * 100)}%)`
  );
  console.log(
    `  Hard:   ${diffCounts.hard} (${Math.round((diffCounts.hard / totalItems) * 100)}%)`
  );
  console.log();

  // Validation errors
  if (allErrors.length > 0) {
    console.log("--- Validation Issues ---");
    console.log(`  Errors:   ${errorCount}`);
    console.log(`  Warnings: ${warningCount}`);
    console.log();

    if (errorCount > 0) {
      console.log("  ERRORS:");
      for (const err of allErrors.filter((e) => e.severity === "error")) {
        const itemStr = err.itemId ? ` [${err.itemId}]` : "";
        console.log(`    [ERR] ${err.file}${itemStr}: ${err.message}`);
      }
      console.log();
    }

    if (warningCount > 0) {
      console.log("  WARNINGS:");
      for (const err of allErrors.filter((e) => e.severity === "warning")) {
        const itemStr = err.itemId ? ` [${err.itemId}]` : "";
        console.log(`    [WRN] ${err.file}${itemStr}: ${err.message}`);
      }
      console.log();
    }
  } else {
    console.log("--- Validation Issues ---");
    console.log("  No validation errors or warnings found.");
    console.log();
  }

  // Final summary
  console.log("=".repeat(70));
  if (errorCount === 0) {
    console.log(
      "  RESULT: PASS - All content validated successfully"
    );
  } else {
    console.log(
      `  RESULT: FAIL - ${errorCount} error(s) found, please fix before seeding`
    );
  }
  console.log("=".repeat(70));
  console.log();

  // Exit with error code if validation failed
  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
