import { z } from "zod";
import { blueprint, domainSlugs, exams, flashcards, labs, objectiveIds, studyGuides } from "./catalog";
import { studyStore, StudyConflictError, type createStudyStore } from "./store";
import { dashboardStats } from "./dashboard";
import { gradeExam, publicExam, questionsFor } from "./exams";
import { createTutorMemory, sendTutor } from "./tutor";
type Store = ReturnType<typeof createStudyStore>;
const error = (message: string, status = 400) => Response.json({ error: message }, { status });
const methods = (allowed: string[]) => Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });
function readBody(init: RequestInit) {
    if (new Headers(init.headers).get("Content-Type")?.split(";")[0].trim() !== "application/json")
        throw new Error("Expected application/json.");
    if (typeof init.body !== "string" || new TextEncoder().encode(init.body).length > 256 * 1024)
        throw new Error("Invalid or oversized request body.");
    try { return JSON.parse(init.body) as unknown; }
    catch { throw new Error("Invalid JSON request body."); }
}
function location(input: RequestInfo | URL) {
    if (typeof input !== "string" || !/^\/api\/[a-zA-Z0-9/?=&._-]+$/.test(input) || input.includes(".."))
        throw new Error("Only bundled local study routes are supported.");
    return new URL(input, "http://study.invalid");
}
function readRoutes(path: string, query: URLSearchParams, store: Store): unknown {
    const state = store.getSnapshot().state, domain = query.get("domain") ?? undefined;
    if (domain && !domainSlugs.includes(domain))
        throw new Error("Unknown study domain.");
    if (path === "/api/flashcards")
        return { flashcards: domain ? flashcards.filter(card => card.domainSlug === domain) : flashcards, total: flashcards.filter(card => !domain || card.domainSlug === domain).length, byDomain: Object.fromEntries(blueprint.domains.map(item => [item.slug, flashcards.filter(card => card.domainSlug === item.slug).length])) };
    if (path === "/api/flashcards/progress")
        return { progress: state.flashcards };
    if (path === "/api/study/progress")
        return { completed: state.objectives };
    if (path === "/api/exams/attempts")
        return { attempts: state.examAttempts };
    if (path === "/api/exams")
        return { exams: exams.map(exam => ({ examId: exam.examId, title: exam.title, description: exam.description, totalQuestions: questionsFor(exam.examId, domain)!.totalQuestions, timeLimit: exam.timeLimit })) };
    if (path === "/api/labs/attempts")
        return { attempts: Object.fromEntries(Object.entries(state.labs).map(([slug, record]) => [slug, { labSlug: slug, status: record.completed ? "completed" : "started", lastAttemptAt: record.updatedAt }])) };
    if (path === "/api/labs")
        return { labs: labs.filter(lab => (!domain || lab.domainSlug === domain) && (!query.get("type") || lab.type === query.get("type"))) };
    if (path === "/api/dashboard/stats")
        return { stats: dashboardStats(state) };
    const [, , resource, id, subpath] = path.split("/");
    if (resource === "exams" && !subpath)
        return publicExam(id, domain);
    if (resource === "study" && !subpath)
        return studyGuides.find(guide => guide.slug === id) ?? null;
    if (resource === "labs") {
        const lab = labs.find(item => item.slug === id);
        if (!lab)
            return null;
        if (subpath === "solution")
            return { solutionCode: lab.solutionCode, expectedOutput: lab.expectedOutput };
        if (!subpath)
            return lab;
    }
    return null;
}
function writeRoutes(path: string, query: URLSearchParams, body: unknown, store: Store): unknown {
    if (path === "/api/study/progress") {
        const data = z.object({ objectiveCode: z.enum(objectiveIds as [
                string,
                ...string[]
            ]), completed: z.boolean() }).strict().parse(body);
        store.setObjective(data.objectiveCode, data.completed);
        return { ok: true };
    }
    if (path === "/api/flashcards/progress") {
        const data = z.object({ flashcardId: z.string(), quality: z.number().int().min(0).max(5), currentProgress: z.unknown().optional() }).strict().parse(body);
        return { progress: store.rateFlashcard(data.flashcardId, data.quality) };
    }
    const match = path.match(/^\/api\/exams\/([a-z0-9-]+)\/grade$/);
    if (!match)
        return null;
    const data = z.object({ answers: z.record(z.string().max(100), z.union([z.string().max(2000), z.array(z.string().max(2000)).max(50)])), timeTaken: z.number().int().min(0).max(86400).optional() }).strict().parse(body);
    const domain = query.get("domain") ?? undefined;
    if (domain && !domainSlugs.includes(domain))
        throw new Error("Unknown study domain.");
    const result = gradeExam(match[1], data.answers, data.timeTaken ?? 0, domain);
    if (!result)
        return null;
    const now = new Date();
    store.addExamAttempt({ id: crypto.randomUUID(), examId: match[1], score: result.score, totalQuestions: result.totalQuestions, domainFilter: domain ?? null, startedAt: new Date(now.getTime() - (data.timeTaken ?? 0) * 1000).toISOString(), completedAt: now.toISOString() });
    return result;
}
export function createLocalFetch(store: Store, network: typeof fetch) {
    const tutor = createTutorMemory();
    return async function localFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
        try {
            const url = location(input), path = url.pathname, method = (init.method ?? "GET").toUpperCase();
            if (init.signal?.aborted)
                throw new DOMException("Request aborted", "AbortError");
            const body = ["POST", "PATCH", "PUT"].includes(method) ? readBody(init) : null;
            if (path === "/api/chat")
                return method === "POST" ? await sendTutor(body, init.signal, network) : methods(["POST"]);
            if (/^\/api\/tutor\/conversations(?:\/[a-zA-Z0-9-]+(?:\/messages)?)?$/.test(path))
                return tutor(path, method, body);
            if (method === "GET") {
                const result = readRoutes(path, url.searchParams, store);
                return result === null ? error("Study resource not found", 404) : Response.json(result);
            }
            if (method === "POST") {
                const result = writeRoutes(path, url.searchParams, body, store);
                return result === null ? error("Study resource not found", 404) : Response.json(result);
            }
            return methods(["GET"]);
        }
        catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError")
                throw cause;
            if (cause instanceof StudyConflictError) return error(cause.message, 409);
            if (cause instanceof z.ZodError)
                return error("Invalid study request.");
            const message = cause instanceof Error ? cause.message : "Could not complete the study request.";
            return error(message, message.includes("saved to browser") ? 507 : 400);
        }
    };
}
export const localFetch = createLocalFetch(studyStore, (input, init) => globalThis.fetch(input, init));
