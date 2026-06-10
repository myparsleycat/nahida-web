import { createStore, useStore } from "zustand";

type Status = "pending" | "collecting" | "hashing" | "transmitting";

interface ModState {
    status: Status;
    setStatus: (v: Status) => void;
    totalItems: number;
    setTotalItems: (v: number) => void;
    totalBytes: number;
    setTotalBytes: (v: number) => void;
    sentItems: number;
    setSentItems: (v: number) => void;
    sentBytes: number;
    setSentBytes: (v: number) => void;
    speed: number;
    setSpeed: (v: number) => void;
    progress: number;
    setProgress: (v: number) => void;
    clear: () => void;
}

export const modStore = createStore<ModState>((set) => ({
    status: "pending",
    setStatus: (v: Status) => set(() => ({ status: v })),
    totalItems: 0,
    setTotalItems: (v: number) => set(() => ({ totalItems: v })),
    totalBytes: 0,
    setTotalBytes: (v: number) => set(() => ({ totalBytes: v })),
    sentItems: 0,
    setSentItems: (v: number) => set(() => ({ sentItems: v })),
    sentBytes: 0,
    setSentBytes: (v: number) => set(() => ({ sentBytes: v })),
    speed: 0,
    setSpeed: (v: number) => set(() => ({ speed: v })),
    progress: 0,
    setProgress: (v: number) => set(() => ({ progress: v })),
    clear: () =>
        set({
            status: "pending",
            totalItems: 0,
            sentItems: 0,
            speed: 0,
            progress: 0,
        }),
}));

export const useModStore = () => useStore(modStore);
