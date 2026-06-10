import { create } from "zustand";

interface LoadingState {
    createDirLoading: boolean;
    renameLoading: boolean;
    makePubLinkLoading: boolean;
}

interface LoadingActions {
    setLoading: (key: keyof LoadingState, value: boolean) => void;
}

export const useLoadingStore = create<LoadingState & LoadingActions>((set) => ({
    createDirLoading: false,
    renameLoading: false,
    makePubLinkLoading: false,

    setLoading: (key, value) =>
        set((state) => ({
            ...state,
            [key]: value,
        })),
}));
