import { createStore, useStore } from "zustand";

interface GlobalStore {
    fpHash: string | null;
    setFpHash: (v: string) => void;
}

export const globalStore = createStore<GlobalStore>((set) => ({
    fpHash: null,
    setFpHash: (fpHash) => set({ fpHash }),
}));

export const useGlobalStore = () => useStore(globalStore);
