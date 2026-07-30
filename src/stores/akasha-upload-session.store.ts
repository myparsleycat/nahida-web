import { createStore, useStore } from "zustand";

import type { UploadSessionSnapshot } from "@/lib/akasha/upload-v2/types";

type SessionActions = {
    retry: (requestId: string) => Promise<void>;
    dismiss: (requestId: string) => Promise<void>;
};

let sessionActions: SessionActions | null = null;

interface UploadSessionViewState {
    snapshots: Record<string, UploadSessionSnapshot>;
    hydrated: boolean;
    setHydrated: (value: boolean) => void;
    replaceSnapshots: (snapshots: UploadSessionSnapshot[]) => void;
    upsertSnapshot: (snapshot: UploadSessionSnapshot) => void;
    removeSnapshot: (requestId: string) => void;
    retry: (requestId: string) => Promise<void>;
    dismiss: (requestId: string) => Promise<void>;
}

export const uploadSessionStore = createStore<UploadSessionViewState>((set) => ({
    snapshots: {},
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
    removeSnapshot: (requestId) =>
        set((state) => {
            const snapshots = { ...state.snapshots };
            delete snapshots[requestId];
            return { snapshots };
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
