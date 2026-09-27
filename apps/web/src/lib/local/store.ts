import { emptyProgress, MAX_ATTEMPTS, parseBackup, validateProgress, type ExamAttempt, type StudyProgress } from "./schema";
import { reviewCard } from "./sm2";
export const STORAGE_KEY = "devnet-study-progress-v1";
export const LEGACY_KEY = "devnet-flashcard-progress";
const CONFLICT_MESSAGE = "Progress changed in another tab. Export this tab’s unsaved progress, then reload before importing, resetting, or saving again.";
export class StudyConflictError extends Error {}
interface StoragePort {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export interface StudySnapshot {
    state: StudyProgress;
    error: string | null;
    migration: string | null;
}
function freeze<T>(value: T): T { if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
} return value; }
export function createStudyStore(storage: () => StoragePort) {
    let snapshot: StudySnapshot = freeze({ state: emptyProgress(), error: null, migration: null });
    let loaded = false, blocked = false, conflicted = false;
    let lastSeen: string | null | undefined;
    let listeners: ReadonlyArray<() => void> = [];
    const emit = () => listeners.forEach(listener => listener());
    function load() {
        if (loaded)
            return;
        loaded = true;
        try {
            const port = storage(), saved = port.getItem(STORAGE_KEY);
            lastSeen = saved;
            if (saved !== null) {
                try {
                    snapshot = freeze({ ...snapshot, state: parseBackup(saved) });
                }
                catch {
                    blocked = true;
                    snapshot = freeze({ ...snapshot, error: "Saved progress is invalid. Import a valid backup or reset explicitly; the original data has been preserved." });
                }
                return;
            }
            const legacy = port.getItem(LEGACY_KEY);
            if (legacy === null)
                return;
            const state = validateProgress({ ...emptyProgress(), flashcards: JSON.parse(legacy) });
            snapshot = freeze({ state, error: null, migration: "Previous flashcard progress migrated. The original flashcard backup remains unchanged." });
            if (port.getItem(STORAGE_KEY) !== lastSeen) throw new StudyConflictError(CONFLICT_MESSAGE);
            const serialized = JSON.stringify(state);
            port.setItem(STORAGE_KEY, serialized);
            lastSeen = serialized;
        }
        catch {
            snapshot = freeze({ ...snapshot, error: "Browser storage could not be read or migrated. Export your progress before closing this page." });
        }
    }
    function commit(state: StudyProgress, recovery = false) {
        load();
        if (blocked && !recovery)
            throw new Error("Import a valid backup or reset before saving over invalid stored progress.");
        if (conflicted) throw new StudyConflictError(CONFLICT_MESSAGE);
        const valid = freeze(validateProgress(state));
        try {
            const port = storage();
            if (port.getItem(STORAGE_KEY) !== lastSeen) {
                conflicted = true;
                throw new StudyConflictError(CONFLICT_MESSAGE);
            }
            const serialized = JSON.stringify(valid);
            port.setItem(STORAGE_KEY, serialized);
            lastSeen = serialized;
            blocked = false;
            snapshot = freeze({ ...snapshot, state: valid, error: null });
        }
        catch (cause) {
            snapshot = freeze({ ...snapshot, state: valid, error: cause instanceof StudyConflictError ? CONFLICT_MESSAGE : "Changes could not be saved to browser storage. Export your progress before closing this page." });
            emit();
            if (cause instanceof StudyConflictError) throw cause;
            throw new Error(snapshot.error!);
        }
        emit();
    }
    const current = () => { load(); return snapshot.state; };
    function updateLab(slug: string, patch: {
        draft?: string;
        completed?: boolean;
    }) { const state = current(); commit({ ...state, labs: { ...state.labs, [slug]: { ...(state.labs[slug] ?? { draft: "", completed: false }), ...patch, updatedAt: new Date().toISOString() } } }); }
    return {
        getSnapshot: () => { load(); return snapshot; },
        subscribe: (listener: () => void) => { listeners = [...listeners, listener]; return () => { listeners = listeners.filter(item => item !== listener); }; },
        exportProgress: () => JSON.stringify(current(), null, 2),
        importProgress: (raw: string) => commit(parseBackup(raw), true),
        reset: () => commit(emptyProgress(), true),
        setObjective: (id: string, completed: boolean) => { const state = current(); commit({ ...state, objectives: completed ? [...new Set([...state.objectives, id])] : state.objectives.filter(value => value !== id) }); },
        rateFlashcard: (id: string, quality: number) => { const state = current(), progress = reviewCard(id, quality, state.flashcards[id]); commit({ ...state, flashcards: { ...state.flashcards, [id]: progress } }); return progress; },
        saveLabDraft: (slug: string, draft: string) => updateLab(slug, { draft }),
        setLabCompleted: (slug: string, completed: boolean) => updateLab(slug, { completed }),
        setPreferences: (patch: Partial<StudyProgress["preferences"]>) => { const state = current(); commit({ ...state, preferences: { ...state.preferences, ...patch } }); },
        addExamAttempt: (attempt: ExamAttempt) => { const state = current(); commit({ ...state, examAttempts: [attempt, ...state.examAttempts].slice(0, MAX_ATTEMPTS) }); },
    };
}
export const studyStore = createStudyStore(() => window.localStorage);
export const getStudySnapshot = studyStore.getSnapshot;
export const subscribeStudy = studyStore.subscribe;
export const exportStudyProgress = studyStore.exportProgress;
export const importStudyProgress = studyStore.importProgress;
export const resetStudyProgress = studyStore.reset;
export const saveLabDraft = studyStore.saveLabDraft;
export const setLabCompleted = studyStore.setLabCompleted;
export const setPreferences = studyStore.setPreferences;
export const rateFlashcard = studyStore.rateFlashcard;
