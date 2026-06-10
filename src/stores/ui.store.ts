import { create } from "zustand";

interface UIStore {
    loginDialogOpen: boolean;
    setLoginDialogOpen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
    loginDialogOpen: false,
    setLoginDialogOpen: (v: boolean) => set({ loginDialogOpen: v }),
}));
