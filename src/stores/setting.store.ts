import { merge } from "es-toolkit";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SettingsState {
    gifCursor: boolean;
    updateSettings: (newSettings: Partial<SettingsState>) => void;
    resetSettings: () => void;
}

const initialState = {
    gifCursor: true,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            ...initialState,

            updateSettings: (newSettings) => set((state) => merge({ ...state }, newSettings)),

            resetSettings: () => set(initialState),
        }),
        {
            name: "nhd-settings",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
