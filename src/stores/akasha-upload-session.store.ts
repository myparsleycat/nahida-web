import { createStore, useStore } from "zustand";

import type { UploadSessionSnapshot } from "@/lib/akasha/upload-v2/types";

type SessionActions = {
    retry: (requestId: string) => Promise<void>;
    dismiss: (requestId: string) => Promise<void>;
};

let sessionActions: SessionActions | null = null;

interface UploadSessionViewState {
    snapshots: Record<string, UploadSessionSnapshot>;
    inflightBytes: Record<string, Record<string, number>>;
    hydrated: boolean;
    setHydrated: (value: boolean) => void;
    replaceSnapshots: (snapshots: UploadSessionSnapshot[]) => void;
    upsertSnapshot: (snapshot: UploadSessionSnapshot) => void;
    setInflightBytes: (requestId: string, jobKey: string, bytes: number) => void;
    clearInflightJob: (requestId: string, jobKey: string) => void;
    clearInflightRequest: (requestId: string) => void;
    removeSnapshot: (requestId: string) => void;
    retry: (requestId: string) => Promise<void>;
    dismiss: (requestId: string) => Promise<void>;
}

export const uploadSessionStore = createStore<UploadSessionViewState>((set) => ({
    snapshots: {},
    inflightBytes: {},
    hydrated: false,
    setHydrated: (hydrated) => set({ hydrated }),
    replaceSnapshots: (snapshots) =>
        set({
            snapshots: Object.fromEntries(snapshots.map((item) => [item.session.requestId, item])),
        }),
    upsertSnapshot: (snapshot) =>
        set((state) => ({
            snapshots: { ...state.snapshots, [snapshot.session.requestId]: snapshot },
        })),
    setInflightBytes: (requestId, jobKey, bytes) =>
        set((state) => ({
            inflightBytes: {
                ...state.inflightBytes,
                [requestId]: { ...state.inflightBytes[requestId], [jobKey]: bytes },
            },
        })),
    clearInflightJob: (requestId, jobKey) =>
        set((state) => {
            const requestJobs = state.inflightBytes[requestId];
            if (!requestJobs || !(jobKey in requestJobs)) return state;
            const nextJobs = { ...requestJobs };
            delete nextJobs[jobKey];
            const inflightBytes = { ...state.inflightBytes };
            if (Object.keys(nextJobs).length === 0) delete inflightBytes[requestId];
            else inflightBytes[requestId] = nextJobs;
            return { inflightBytes };
        }),
    clearInflightRequest: (requestId) =>
        set((state) => {
            if (!(requestId in state.inflightBytes)) return state;
            const inflightBytes = { ...state.inflightBytes };
            delete inflightBytes[requestId];
            return { inflightBytes };
        }),
    removeSnapshot: (requestId) =>
        set((state) => {
            const snapshots = { ...state.snapshots };
            delete snapshots[requestId];
            const inflightBytes = { ...state.inflightBytes };
            delete inflightBytes[requestId];
            return { snapshots, inflightBytes };
        }),
    retry: async (requestId) => {
        if (!sessionActions) throw new Error("upload_session_not_initialized");
        await sessionActions.retry(requestId);
    },
    dismiss: async (requestId) => {
        if (!sessionActions) throw new Error("upload_session_not_initialized");
        await sessionActions.dismiss(requestId);
    },
}));

export function registerUploadSessionActions(actions: SessionActions) {
    sessionActions = actions;
    return () => {
        if (sessionActions === actions) sessionActions = null;
    };
}

export const useUploadSessionStore = () => useStore(uploadSessionStore);
