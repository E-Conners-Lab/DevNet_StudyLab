"use client";
import { useSyncExternalStore } from "react";
import { getStudySnapshot, subscribeStudy, type StudySnapshot } from "./store";
import { emptyProgress } from "./schema";
const serverSnapshot: StudySnapshot = { state: emptyProgress(), error: null, migration: null };
export function useStudyStore() { return useSyncExternalStore(subscribeStudy, getStudySnapshot, () => serverSnapshot); }
