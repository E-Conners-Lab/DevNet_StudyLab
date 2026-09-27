import { describe, expect, it, vi } from "vitest";
import { createStudyStore } from "./store";
import { createLocalFetch } from "./client";
import { gradeAnswer, gradeExam, publicExam } from "./exams";
import { reviewCard } from "./sm2";
import { emptyProgress, validateProgress } from "./schema";
import { exams, flashcards } from "./catalog";
const memory = () => { let value: string | null = null; return createStudyStore(() => ({ getItem: () => value, setItem: (_key: string, next: string) => { value = next; } })); };
const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
describe("local study failure boundaries", () => {
    it("grades every supported answer type without forgiving duplicate or misordered answers", () => {
        expect(gradeAnswer({ type: "multiple_choice", correctAnswer: "A" }, " a ")).toBe(true);
        expect(gradeAnswer({ type: "multiple_choice", correctAnswer: "A" }, ["A"])).toBe(false);
        expect(gradeAnswer({ type: "fill_in_the_blank", correctAnswer: "JSON" }, " json ")).toBe(true);
        expect(gradeAnswer({ type: "multiple_select", correctAnswer: ["A", "B"] }, ["b", "a"])).toBe(true);
        expect(gradeAnswer({ type: "multiple_select", correctAnswer: ["A", "B"] }, ["A", "A"])).toBe(false);
        expect(gradeAnswer({ type: "multiple_select", correctAnswer: ["A", "B"] }, "A")).toBe(false);
        expect(gradeAnswer({ type: "drag_and_drop", correctAnswer: ["A", "B"] }, ["B", "A"])).toBe(false);
        expect(gradeAnswer({ type: "drag_and_drop", correctAnswer: ["A", "B"] }, ["A", "B"])).toBe(true);
        expect(gradeAnswer({ type: "multiple_choice", correctAnswer: "A" }, null)).toBe(false);
        expect(gradeExam("absent", {}, 0)).toBeNull();
        expect(publicExam("absent")).toBeNull();
        expect(publicExam("domain-quiz")?.title).toBe("Domain Quiz");
        expect(gradeExam("domain-quiz", {}, 0, "apis")?.score).toBe(0);
    });
    it("progressively schedules SM-2 and resets forgotten cards with a bounded ease", () => {
        const date = new Date("2026-09-27T00:00:00.000Z");
        let card = reviewCard(flashcards[0].id, 5, undefined, date);
        expect(card.interval).toBe(1);
        card = reviewCard(card.flashcardId, 5, card, date);
        expect(card.interval).toBe(6);
        card = reviewCard(card.flashcardId, 5, card, date);
        expect(card.interval).toBeGreaterThan(6);
        card = reviewCard(card.flashcardId, 0, { ...card, ease: 1.3 }, date);
        expect(card.repetitions).toBe(0);
        expect(card.ease).toBe(1.3);
    });
    it("retains at most 100 attempts and does not mutate snapshots", () => {
        const store = memory(), before = store.getSnapshot();
        const now = new Date().toISOString();
        for (let index = 0; index < 102; index++)
            store.addExamAttempt({ id: crypto.randomUUID(), examId: exams[0].examId, score: index % 100, totalQuestions: 40, domainFilter: null, startedAt: now, completedAt: now });
        expect(store.getSnapshot().state.examAttempts).toHaveLength(100);
        expect(before.state.examAttempts).toEqual([]);
        expect(Object.isFrozen(store.getSnapshot().state)).toBe(true);
    });
    it("rejects every invalid state field and protects record keys", () => {
        for (const patch of [{ objectives: ["1.1", "1.1"] }, { preferences: { examTimer: true, apiKey: "secret" } }, { labs: { ["__proto__"]: { draft: "", completed: true, updatedAt: "bad" } } }, { examAttempts: [{ id: "bad" }] }])
            expect(() => validateProgress({ ...emptyProgress(), ...patch })).toThrow();
        expect(() => validateProgress({ ...emptyProgress(), flashcards: { [flashcards[0].id]: { ...reviewCard(flashcards[1].id, 5) } } })).toThrow();
    });
    it("returns useful errors for unsupported routes and invalid payloads", async () => {
        const fetch = createLocalFetch(memory(), vi.fn());
        for (const path of ["/api/exams/bad", "/api/labs/bad", "/api/study/bad", "/api/labs/python-data-parsing/other"])
            expect((await fetch(path)).status).toBe(404);
        expect((await fetch("/api/exams?domain=bad")).status).toBe(400);
        expect((await fetch("/api/exams/bad/grade", post({ answers: {} }))).status).toBe(404);
        expect((await fetch(`/api/exams/${exams[0].examId}/grade?domain=bad`, post({ answers: {} }))).status).toBe(400);
        expect((await fetch("/api/flashcards/progress", post({ flashcardId: "bad", quality: 2 }))).status).toBe(400);
        expect((await fetch("/api/chat")).status).toBe(405);
        expect((await fetch("/api/study/progress", post({ data: "x".repeat(300000) }))).status).toBe(400);
    });
    it("surfaces quota failures and cancellation and refuses a malformed tutor session", async () => {
        const store = createStudyStore(() => ({ getItem: () => null, setItem: () => { throw Error("disk"); } }));
        expect((await createLocalFetch(store, vi.fn())("/api/study/progress", post({ objectiveCode: "1.1", completed: true }))).status).toBe(507);
        const controller = new AbortController();
        controller.abort();
        await expect(createLocalFetch(memory(), vi.fn())("/api/labs", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
        const network = vi.fn().mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 }));
        const fetch = createLocalFetch(memory(), network);
        expect((await fetch("/api/chat", post({}))).status).toBe(503);
        network.mockResolvedValue(Response.json({}));
        expect((await fetch("/api/chat", post({}))).status).toBe(503);
        expect(network).toHaveBeenCalledTimes(2);
        network.mockRejectedValueOnce(new Error("private upstream detail"));
        const unavailable = await fetch("/api/chat", post({}));
        expect(unavailable.status).toBe(503);
        expect(await unavailable.text()).not.toContain("private upstream detail");
        network.mockRejectedValueOnce(new DOMException("Request aborted", "AbortError"));
        await expect(fetch("/api/chat", post({}))).rejects.toMatchObject({ name: "AbortError" });
    });
    it("bounds memory tutor content and conversations", async () => {
        const fetch = createLocalFetch(memory(), vi.fn());
        let id = "";
        for (let index = 0; index < 20; index++)
            id = (await (await fetch("/api/tutor/conversations", post({ title: "Topic", domainId: null }))).json()).id;
        expect((await fetch("/api/tutor/conversations", post({ title: "Topic", domainId: null }))).status).toBe(409);
        expect((await fetch(`/api/tutor/conversations/${id}/messages`, post({ role: "system", content: "test" }))).status).toBe(400);
        for (let index = 0; index < 100; index++)
            await fetch(`/api/tutor/conversations/${id}/messages`, post({ role: "user", content: "test" }));
        expect((await fetch(`/api/tutor/conversations/${id}/messages`, post({ role: "user", content: "test" }))).status).toBe(409);
        expect((await fetch(`/api/tutor/conversations/${id}/messages`)).status).toBe(405);
    });
});
