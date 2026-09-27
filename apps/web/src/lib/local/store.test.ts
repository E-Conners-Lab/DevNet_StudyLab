import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudyStore, STORAGE_KEY, LEGACY_KEY } from "./store";
import { emptyProgress, validateProgress, MAX_BACKUP_BYTES } from "./schema";
import { flashcards } from "./catalog";
const memory = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; };
describe("local progress durability and validation", () => {
    beforeEach(() => vi.restoreAllMocks());
    it("saves all learner state and restores a validated backup", () => {
        const storage = memory();
        const store = createStudyStore(() => storage);
        store.setObjective("1.1", true);
        store.rateFlashcard(flashcards[0].id, 5);
        store.saveLabDraft("python-data-parsing", "print('hello')");
        store.setLabCompleted("python-data-parsing", true);
        store.setPreferences({ examTimer: false });
        const copy = createStudyStore(() => memory());
        copy.importProgress(store.exportProgress());
        expect(copy.getSnapshot().state).toEqual(store.getSnapshot().state);
        expect(createStudyStore(() => storage).getSnapshot().state).toEqual(store.getSnapshot().state);
        store.setObjective("1.1", false);
        expect(store.getSnapshot().state.objectives).toEqual([]);
        store.reset();
        expect(store.getSnapshot().state).toEqual(emptyProgress());
    });
    it("rejects malformed, future, unknown-ID and oversized backups without replacing data", () => {
        const store = createStudyStore(() => memory());
        store.setObjective("1.1", true);
        const before = store.exportProgress();
        for (const raw of ["bad", JSON.stringify({ ...emptyProgress(), schemaVersion: 2 }), JSON.stringify({ ...emptyProgress(), contentVersion: "future" }), JSON.stringify({ ...emptyProgress(), objectives: ["999"] }), " ".repeat(MAX_BACKUP_BYTES + 1)]) {
            expect(() => store.importProgress(raw)).toThrow();
            expect(store.exportProgress()).toBe(before);
        }
    });
    it("migrates validated legacy flashcards once and preserves the original", () => {
        const storage = memory();
        const progress = { flashcardId: flashcards[0].id, repetitions: 1, ease: 2.6, interval: 1, nextReview: new Date().toISOString(), lastReview: new Date().toISOString(), quality: 5 };
        storage.setItem(LEGACY_KEY, JSON.stringify({ [progress.flashcardId]: progress }));
        const store = createStudyStore(() => storage);
        expect(store.getSnapshot().migration).toMatch(/migrated/i);
        expect(store.getSnapshot().state.flashcards[progress.flashcardId]).toEqual(progress);
        expect(storage.getItem(LEGACY_KEY)).not.toBeNull();
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });
    it("keeps corrupt saved data untouched and reports the recovery requirement", () => {
        const storage = memory();
        storage.setItem(STORAGE_KEY, "bad");
        const store = createStudyStore(() => storage);
        expect(store.getSnapshot().error).toBeTruthy();
        expect(storage.getItem(STORAGE_KEY)).toBe("bad");
        expect(() => store.setObjective("1.1", true)).toThrow(/reset|import/i);
    });
    it("retains recoverable changes on storage failure, reports errors and permits export", () => {
        const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
        const store = createStudyStore(() => storage);
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        expect(() => store.setObjective("1.1", true)).toThrow(/saved/i);
        expect(store.getSnapshot().state.objectives).toEqual(["1.1"]);
        expect(store.getSnapshot().error).toBeTruthy();
        expect(JSON.parse(store.exportProgress()).objectives).toEqual(["1.1"]);
        expect(listener).toHaveBeenCalled();
        unsubscribe();
    });
    it("reports blocked read access without leaking the underlying exception", () => {
        const store = createStudyStore(() => { throw new Error("sensitive implementation detail"); });
        expect(store.getSnapshot().error).not.toContain("sensitive");
        expect(() => store.setObjective("1.1", true)).toThrow();
    });
    it("validates all record boundaries and limits", () => {
        expect(() => validateProgress({ ...emptyProgress(), extra: "secret" })).toThrow();
        expect(() => validateProgress({ ...emptyProgress(), labs: { "python-data-parsing": { draft: "x".repeat(131073), completed: false, updatedAt: new Date().toISOString() } } })).toThrow();
        expect(() => validateProgress({ ...emptyProgress(), flashcards: { bad: {} } })).toThrow();
        const store = createStudyStore(() => memory());
        expect(() => store.rateFlashcard("bad", 3)).toThrow();
        expect(() => store.rateFlashcard(flashcards[0].id, 6)).toThrow();
        expect(() => store.setLabCompleted("bad", true)).toThrow();
    });
});

describe("multiple-tab write conflicts", () => {
    it("preserves another tab's saved progress and keeps this tab's changes exportable", () => {
        const storage = memory();
        const first = createStudyStore(() => storage);
        const second = createStudyStore(() => storage);
        first.getSnapshot(); second.getSnapshot();
        first.setObjective("1.1", true);
        const saved = storage.getItem(STORAGE_KEY);
        expect(() => second.saveLabDraft("python-data-parsing", "print('unsaved')")).toThrow(/another tab|reload/i);
        expect(storage.getItem(STORAGE_KEY)).toBe(saved);
        expect(second.getSnapshot().error).toMatch(/export.*reload/i);
        expect(JSON.parse(second.exportProgress()).labs["python-data-parsing"].draft).toBe("print('unsaved')");
        expect(() => second.reset()).toThrow(/reload/i);
        expect(() => second.importProgress(first.exportProgress())).toThrow(/reload/i);
        expect(storage.getItem(STORAGE_KEY)).toBe(saved);
        const reloaded = createStudyStore(() => storage);
        expect(reloaded.getSnapshot().state.objectives).toEqual(["1.1"]);
        reloaded.reset();
        reloaded.importProgress(saved!);
        expect(reloaded.getSnapshot().state.objectives).toEqual(["1.1"]);
    });
});
