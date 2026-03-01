/**
 * Data Access Layer — Study Guides
 *
 * Study guides are always loaded from JSON files because they are
 * not represented in the database schema (rich, structured content
 * that doesn't benefit from relational storage).
 */

import fs from "fs";
import path from "path";

import { SLUG_TO_STUDY_FILE } from "@/lib/domains";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Resource {
  title: string;
  url: string;
}

export interface KeyTopic {
  objectiveCode: string;
  title: string;
  summary: string;
  keyPoints: string[];
  examTips: string[];
  resources: Resource[];
}

export interface StudyGuide {
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
// Helpers
// ---------------------------------------------------------------------------

function getStudyGuidesDir(): string {
  return path.join(process.cwd(), "..", "..", "content", "study-guides");
}

// Module-level cache (safe — study guide JSON is static at runtime)
const studyGuideCache = new Map<string, StudyGuide>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the study guide for the given domain slug, or null if not found.
 */
export function getStudyGuide(slug: string): StudyGuide | null {
  const cached = studyGuideCache.get(slug);
  if (cached) return cached;

  const filename = SLUG_TO_STUDY_FILE[slug];
  if (!filename) return null;

  const dir = getStudyGuidesDir();
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;

  const guide = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StudyGuide;
  studyGuideCache.set(slug, guide);
  return guide;
}
