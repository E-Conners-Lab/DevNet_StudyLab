import { z } from "zod";
import { domainSlugs, exams, flashcards, labs, objectiveIds } from "./catalog";
export const CONTENT_VERSION = "2026-09-27";
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_DRAFT_BYTES = 128 * 1024;
export const MAX_ATTEMPTS = 100;
const known = (ids: readonly string[]) => z.string().refine(id => ids.includes(id), "Unknown curriculum ID");
const timestamp = z.iso.datetime();
const count = z.number().int().min(0).max(1000000);
export const flashcardSchema = z.object({
    flashcardId: known(flashcards.map(card => card.id)), repetitions: count,
    ease: z.number().min(1.3).max(100), interval: count,
    nextReview: timestamp, lastReview: timestamp, quality: z.number().int().min(0).max(5),
}).strict();
const attemptSchema = z.object({
    id: z.string().uuid(), examId: known([...exams.map(exam => exam.examId), "domain-quiz"]),
    score: z.number().int().min(0).max(100), totalQuestions: z.number().int().min(1).max(80),
    domainFilter: known(domainSlugs).nullable(), startedAt: timestamp, completedAt: timestamp,
}).strict();
const labSchema = z.object({ draft: z.string().refine(value => new TextEncoder().encode(value).length <= MAX_DRAFT_BYTES, "Lab draft exceeds 128 KiB"), completed: z.boolean(), updatedAt: timestamp }).strict();
const progressSchema = z.object({
    schemaVersion: z.literal(1), contentVersion: z.literal(CONTENT_VERSION),
    objectives: z.array(known(objectiveIds)).max(objectiveIds.length).refine(ids => new Set(ids).size === ids.length, "Duplicate objectives"),
    flashcards: z.record(known(flashcards.map(card => card.id)), flashcardSchema).refine(records => Object.entries(records).every(([id, value]) => id === value.flashcardId), "Card ID mismatch"),
    examAttempts: z.array(attemptSchema).max(MAX_ATTEMPTS),
    labs: z.record(known(labs.map(lab => lab.slug)), labSchema),
    preferences: z.object({ examTimer: z.boolean() }).strict(),
}).strict();
export type StudyProgress = z.infer<typeof progressSchema>;
export type CardProgress = z.infer<typeof flashcardSchema>;
export type ExamAttempt = z.infer<typeof attemptSchema>;
export function emptyProgress(): StudyProgress {
    return { schemaVersion: 1, contentVersion: CONTENT_VERSION, objectives: [], flashcards: {}, examAttempts: [], labs: {}, preferences: { examTimer: true } };
}
export function validateProgress(value: unknown): StudyProgress {
    const records = value && typeof value === "object" ? Object.values(value) : [];
    if (records.some(record => record && typeof record === "object" && Object.keys(record).some(key => ["__proto__", "constructor", "prototype"].includes(key)))) {
        throw new Error("Invalid study backup: unsupported record key.");
    }
    const parsed = progressSchema.safeParse(value);
    if (!parsed.success)
        throw new Error("Invalid study backup: unsupported version, unknown content, or invalid progress. Your existing progress was not replaced.");
    return parsed.data;
}
export function parseBackup(raw: string): StudyProgress {
    if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
        throw new Error("Study backup exceeds 2 MiB.");
    let value: unknown;
    try {
        value = JSON.parse(raw);
    }
    catch {
        throw new Error("Study backup is not valid JSON.");
    }
    return validateProgress(value);
}
