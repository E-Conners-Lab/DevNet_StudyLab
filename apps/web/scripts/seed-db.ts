/**
 * Database Seeder for DevNet StudyLab
 *
 * Reads JSON content files from /content/ and populates the PostgreSQL database.
 * Run: `cd apps/web && npm run db:seed`
 *
 * This script is idempotent — it clears existing content rows before inserting.
 */

import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import * as schema from "../src/lib/db/schema";

// ---------------------------------------------------------------------------
// Load .env.local if DATABASE_URL is not already set
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  if (process.env.DATABASE_URL) return;

  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "ERROR: DATABASE_URL not set.\n" +
      "Start PostgreSQL: docker compose -f docker/docker-compose.yml up -d postgres\n" +
      "Then run: cd apps/web && npm run db:seed"
  );
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

// ---------------------------------------------------------------------------
// Content directories — project root is three levels up from this script
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CONTENT = path.join(ROOT, "content");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

// Map JSON difficulty values to schema enum values
function mapDifficulty(d: string): "easy" | "medium" | "hard" {
  const map: Record<string, "easy" | "medium" | "hard"> = {
    easy: "easy",
    beginner: "easy",
    medium: "medium",
    intermediate: "medium",
    hard: "hard",
    advanced: "hard",
  };
  return map[d.toLowerCase()] ?? "medium";
}

// Map JSON question types to schema enum values
function mapQuestionType(
  t: string
): "multiple_choice" | "multiple_select" | "drag_drop" | "fill_blank" {
  const map: Record<
    string,
    "multiple_choice" | "multiple_select" | "drag_drop" | "fill_blank"
  > = {
    multiple_choice: "multiple_choice",
    multiple_select: "multiple_select",
    drag_and_drop: "drag_drop",
    drag_drop: "drag_drop",
    fill_in_the_blank: "fill_blank",
    fill_blank: "fill_blank",
  };
  return map[t] ?? "multiple_choice";
}

// ---------------------------------------------------------------------------
// Blueprint types
// ---------------------------------------------------------------------------

interface BlueprintObjective {
  code: string;
  title: string;
  description?: string;
  subobjectives?: string[];
}

interface BlueprintDomain {
  number: number;
  slug: string;
  name: string;
  weight: number;
  objectives: BlueprintObjective[];
}

interface Blueprint {
  examCode: string;
  examName: string;
  duration: number;
  domains: BlueprintDomain[];
}

// ---------------------------------------------------------------------------
// Flashcard file type
// ---------------------------------------------------------------------------

interface RawFlashcardFile {
  domain: number;
  domainName: string;
  flashcards: {
    id: string;
    objectiveCode: string;
    question: string;
    answer: string;
    explanation: string;
    sourceUrl: string;
    difficulty: string;
    tags: string[];
  }[];
}

// ---------------------------------------------------------------------------
// Practice exam file type
// ---------------------------------------------------------------------------

interface RawExamFile {
  examId: string;
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number;
  questions: {
    id: string;
    objectiveCode: string;
    type: string;
    question: string;
    options?: string[];
    correctAnswer: unknown;
    explanation: string;
    sourceUrl?: string;
    difficulty: string;
    tags: string[];
  }[];
}

// ---------------------------------------------------------------------------
// Lab file type
// ---------------------------------------------------------------------------

interface RawLabFile {
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
  learningObjectives: string[];
  instructions: string;
  starterCode: string;
  solutionCode: string;
  expectedOutput: string;
  hints: string[];
}

// ---------------------------------------------------------------------------
// Seeding functions
// ---------------------------------------------------------------------------

async function seedDomainsAndObjectives(blueprint: Blueprint) {
  console.log("  Seeding domains and objectives...");

  // Clear existing
  await db.delete(schema.objectives);
  await db.delete(schema.domains);

  const objectiveMap = new Map<string, number>(); // code -> id

  for (const d of blueprint.domains) {
    const [inserted] = await db
      .insert(schema.domains)
      .values({
        slug: d.slug,
        name: d.name,
        description: `Domain ${d.number}: ${d.name} (${d.weight}% of exam)`,
        weight: d.weight,
        orderIndex: d.number,
      })
      .returning();

    for (const obj of d.objectives) {
      const desc = obj.subobjectives
        ? `${obj.title}\n\nSub-objectives:\n${obj.subobjectives.map((s) => `- ${s}`).join("\n")}`
        : obj.title;

      const [insertedObj] = await db
        .insert(schema.objectives)
        .values({
          domainId: inserted.id,
          code: obj.code,
          title: obj.title,
          description: desc,
        })
        .returning();

      objectiveMap.set(obj.code, insertedObj.id);
    }
  }

  console.log(
    `    ✅ ${blueprint.domains.length} domains, ${objectiveMap.size} objectives`
  );
  return objectiveMap;
}

async function seedFlashcards(objectiveMap: Map<string, number>) {
  console.log("  Seeding flashcards...");

  await db.delete(schema.flashcards);

  const dir = path.join(CONTENT, "flashcards");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("domain-") && f.endsWith(".json"))
    .sort();

  let count = 0;

  for (const file of files) {
    const data = readJson<RawFlashcardFile>(path.join(dir, file));

    for (const fc of data.flashcards) {
      // Find objective — try exact match first, then prefix match (e.g. "1.8" matches "1.8")
      let objectiveId = objectiveMap.get(fc.objectiveCode);
      if (!objectiveId) {
        // Try matching by the integer part (e.g. "1.8.a" → "1.8")
        const base = fc.objectiveCode.split(".").slice(0, 2).join(".");
        objectiveId = objectiveMap.get(base);
      }
      if (!objectiveId) {
        console.warn(
          `    ⚠ No objective found for code "${fc.objectiveCode}" in ${file}, skipping`
        );
        continue;
      }

      await db.insert(schema.flashcards).values({
        objectiveId,
        question: fc.question,
        answer: fc.answer,
        explanation: fc.explanation,
        sourceUrl: fc.sourceUrl,
        difficulty: mapDifficulty(fc.difficulty),
        tags: fc.tags,
      });
      count++;
    }
  }

  console.log(`    ✅ ${count} flashcards`);
}

async function seedPracticeQuestions(objectiveMap: Map<string, number>) {
  console.log("  Seeding practice questions...");

  await db.delete(schema.practiceQuestions);

  const dir = path.join(CONTENT, "practice-exams");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let count = 0;

  for (const file of files) {
    const data = readJson<RawExamFile>(path.join(dir, file));

    for (const q of data.questions) {
      let objectiveId = objectiveMap.get(q.objectiveCode);
      if (!objectiveId) {
        const base = q.objectiveCode.split(".").slice(0, 2).join(".");
        objectiveId = objectiveMap.get(base);
      }
      if (!objectiveId) {
        console.warn(
          `    ⚠ No objective for code "${q.objectiveCode}" in ${file}, skipping`
        );
        continue;
      }

      await db.insert(schema.practiceQuestions).values({
        objectiveId,
        type: mapQuestionType(q.type),
        question: q.question,
        options: q.options ?? null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        sourceUrl: q.sourceUrl ?? null,
        difficulty: mapDifficulty(q.difficulty),
        tags: q.tags,
      });
      count++;
    }
  }

  console.log(`    ✅ ${count} practice questions`);
}

async function seedLabs(objectiveMap: Map<string, number>) {
  console.log("  Seeding labs...");

  await db.delete(schema.labs);

  const dir = path.join(CONTENT, "labs");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let count = 0;

  for (const file of files) {
    const data = readJson<RawLabFile>(path.join(dir, file));

    // Labs may have compound objective codes like "5.6/5.8"; use the first code
    const primaryCode = data.objectiveCode.split("/")[0].trim();
    let objectiveId = objectiveMap.get(primaryCode);
    if (!objectiveId) {
      const base = primaryCode.split(".").slice(0, 2).join(".");
      objectiveId = objectiveMap.get(base);
    }
    if (!objectiveId) {
      console.warn(
        `    ⚠ No objective for code "${data.objectiveCode}" in ${file}, skipping`
      );
      continue;
    }

    // Validate lab type against enum
    const validTypes = [
      "python",
      "bash",
      "api",
      "git",
      "docker",
      "ansible",
      "netconf",
    ];
    const labType = validTypes.includes(data.type) ? data.type : "python";

    await db.insert(schema.labs).values({
      objectiveId,
      slug: data.slug,
      title: data.title,
      description: data.description,
      difficulty: mapDifficulty(data.difficulty),
      estimatedMinutes: data.estimatedMinutes,
      type: labType as
        | "python"
        | "bash"
        | "api"
        | "git"
        | "docker"
        | "ansible"
        | "netconf",
      instructions: data.instructions,
      starterCode: data.starterCode,
      solutionCode: data.solutionCode,
      validationScript: null,
      tags: data.tags,
    });
    count++;
  }

  console.log(`    ✅ ${count} labs`);
}

async function seedDefaultUser() {
  console.log("  Seeding default user...");

  const email = "student@devnet.lab";
  const password = "devnet123";
  const hashedPassword = await bcrypt.hash(password, 12);

  // Upsert — don't fail if user already exists
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`    ⏭️  User "${email}" already exists, skipping`);
    return;
  }

  await db.insert(schema.users).values({
    name: "Student",
    email,
    hashedPassword,
  });

  console.log(`    ✅ Created user: ${email} / ${password}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 DevNet StudyLab — Database Seeder\n");

  // Load blueprint
  const blueprint = readJson<Blueprint>(
    path.join(CONTENT, "exam-blueprint.json")
  );
  console.log(
    `📋 Blueprint: ${blueprint.examCode} — ${blueprint.examName}\n`
  );

  const objectiveMap = await seedDomainsAndObjectives(blueprint);
  await seedFlashcards(objectiveMap);
  await seedPracticeQuestions(objectiveMap);
  await seedLabs(objectiveMap);
  await seedDefaultUser();

  console.log("\n✅ Database seeding complete!");

  // Close the connection
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Seeding failed:", err);
  client.end().then(() => process.exit(1));
});
