import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalFetch } from "./client";
import { createStudyStore } from "./store";
import { exams, flashcards, labs } from "./catalog";
const make = () => { let values: Record<string, string> = {}; return createStudyStore(() => ({ getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values = { ...values, [key]: value }; } })); };
const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
describe("bundled curriculum adapter", () => {
    beforeEach(() => { vi.restoreAllMocks(); });
    it("serves canonical study content with no network requests", async () => {
        const net = vi.fn();
        const fetch = createLocalFetch(make(), net);
        for (const path of ["/api/flashcards", "/api/flashcards?domain=apis", "/api/exams", "/api/exams?domain=apis", "/api/exams/domain-quiz?domain=apis", "/api/study/apis", "/api/labs", "/api/labs?domain=software-dev&type=python", `/api/labs/${labs[0].slug}`, `/api/labs/${labs[0].slug}/solution`])
            expect((await fetch(path)).ok, path).toBe(true);
        expect(net).not.toHaveBeenCalled();
        expect((await (await fetch("/api/flashcards")).json()).total).toBe(199);
    });
    it("rejects unsafe destinations, unknown IDs, unsupported methods and malformed mutations", async () => {
        const net = vi.fn();
        const fetch = createLocalFetch(make(), net);
        for (const url of ["https://evil.test/api/chat", "//evil.test/api/chat", "/api/../api/chat", "/api/labs/%2e%2e", "/api/missing"])
            expect((await fetch(url)).ok).toBe(false);
        expect((await fetch("/api/labs", { method: "DELETE" })).status).toBe(405);
        expect((await fetch("/api/study/progress", post({ objectiveCode: "bad", completed: true }))).status).toBe(400);
        expect((await fetch("/api/study/progress", { method: "POST", body: "{" })).status).toBe(400);
        expect((await fetch("/api/study/progress", { method: "POST", body: "{}" })).status).toBe(400);
        expect(net).not.toHaveBeenCalled();
    });
    it("persists objectives, card reviews, exams and lab statuses and derives dashboard totals", async () => {
        const store = make();
        const fetch = createLocalFetch(store, vi.fn());
        expect((await fetch("/api/study/progress", post({ objectiveCode: "1.1", completed: true }))).ok).toBe(true);
        expect((await (await fetch("/api/study/progress")).json()).completed).toEqual(["1.1"]);
        const progress = await (await fetch("/api/flashcards/progress", post({ flashcardId: flashcards[0].id, quality: 5 }))).json();
        expect(progress.progress.repetitions).toBe(1);
        expect((await (await fetch("/api/flashcards/progress")).json()).progress[flashcards[0].id]).toBeTruthy();
        const answers = Object.fromEntries(exams[0].questions.map(q => [q.id, q.correctAnswer]));
        const result = await (await fetch(`/api/exams/${exams[0].examId}/grade`, post({ answers, timeTaken: 42 }))).json();
        expect(result.score).toBe(100);
        expect((await (await fetch("/api/exams/attempts")).json()).attempts).toHaveLength(1);
        store.setLabCompleted(labs[0].slug, true);
        expect((await (await fetch("/api/labs/attempts")).json()).attempts[labs[0].slug].status).toBe("completed");
        const stats = (await (await fetch("/api/dashboard/stats")).json()).stats;
        expect(stats.bestExamScore).toBe(100);
        expect(stats.totalExamAttempts).toBe(1);
        expect(stats.overallProgress).toBeGreaterThan(0);
    });
    it("uses session-bound CSRF only for fixed tutor gateway and preserves abort signals", async () => {
        const network = vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: "csrf" })).mockResolvedValueOnce(new Response("hello"));
        const fetch = createLocalFetch(make(), network);
        const controller = new AbortController();
        expect(await (await fetch("/api/chat", { ...post({ messages: [{ role: "user", content: "Hi" }] }), signal: controller.signal })).text()).toBe("hello");
        expect(network.mock.calls[0][0]).toBe("/api/v1/session");
        expect(network.mock.calls[1][0]).toBe("/api/v1/tutor");
        expect(network.mock.calls[1][1]).toMatchObject({ credentials: "same-origin", signal: controller.signal, headers: { "X-CSRF-Token": "csrf" } });
    });
    it("keeps tutor messages in memory, supports edits and deletion without backups", async () => {
        const store = make(), fetch = createLocalFetch(store, vi.fn());
        const { id } = await (await fetch("/api/tutor/conversations", post({ title: "Private lesson", domainId: 1 }))).json();
        expect((await fetch(`/api/tutor/conversations/${id}/messages`, post({ role: "user", content: "private message" }))).ok).toBe(true);
        expect((await (await fetch(`/api/tutor/conversations/${id}`)).json()).conversation.messages).toHaveLength(1);
        expect((await fetch(`/api/tutor/conversations/${id}`, { ...post({ title: "Updated" }), method: "PATCH" })).ok).toBe(true);
        expect((await (await fetch("/api/tutor/conversations")).json()).conversations[0].title).toBe("Updated");
        expect(store.exportProgress()).not.toContain("private");
        expect((await fetch(`/api/tutor/conversations/${id}`, { method: "DELETE" })).ok).toBe(true);
        expect((await fetch(`/api/tutor/conversations/${id}`)).status).toBe(404);
    });
});
