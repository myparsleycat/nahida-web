import { createStore, useStore } from "zustand";

import type { AkashaQueueActions, AkashaQueueState, CompleteProcess } from "@/lib/akasha/types";

const initialState: AkashaQueueState = {
    upload: {
        current: null,
        queue: [],
        completed: [],
        isProcessing: false,
    },
    download: {
        current: null,
        queue: [],
        completed: [],
        isProcessing: false,
    },
    gamebanana: {
        current: [],
        completed: [],
        isProcessing: false,
    },
    sheetOpen: false,
};

export const akashaStore = createStore<AkashaQueueState & AkashaQueueActions>((set, get) => ({
    ...initialState,

    setUpload: (upload) =>
        set((state) => ({
            ...state,
            upload,
        })),

    setUploadCurrent: (current) =>
        set((state) => ({
            ...state,
            upload: { ...state.upload, current },
        })),

    updateUploadStatus: (status, error) =>
        set((state) => {
            if (!state.upload.current) return state;
            return {
                ...state,
                upload: {
                    ...state.upload,
                    current: {
                        ...state.upload.current,
                        status,
                        ...(error ? { error } : {}),
                    },
                },
            };
        }),

    addToUploadQueue: (process) =>
        set((state) => ({
            ...state,
            upload: {
                ...state.upload,
                queue: [...state.upload.queue, process],
            },
        })),

    removeFromUploadQueue: (pid) =>
        set((state) => ({
            ...state,
            upload: {
                ...state.upload,
                queue: state.upload.queue.filter((item) => item.pid !== pid),
            },
        })),

    addToUploadCompleted: (process) =>
        set((state) => ({
            ...state,
            upload: {
                ...state.upload,
                completed: [...state.upload.completed, process],
            },
        })),

    setUploadProcessing: (isProcessing) =>
        set((state) => ({
            ...state,
            upload: { ...state.upload, isProcessing },
        })),

    completeUpload: (payload) =>
        set((state) => {
            if (!state.upload.current || state.upload.current.pid !== payload.pid) {
                return state;
            }

            const newCompleted: CompleteProcess = {
                pid: payload.pid,
                name: payload.name,
                size: payload.size,
            };

            return {
                ...state,
                upload: {
                    ...state.upload,
                    isProcessing: false,
                    current: null,
                    completed: [...state.upload.completed, newCompleted],
                },
            };
        }),

    clearUploadCompleted: () =>
        set((state) => ({
            ...state,
            upload: { ...state.upload, completed: [] },
        })),

    setDownload: (download) =>
        set((state) => ({
            ...state,
            download,
        })),

    setDownloadCurrent: (current) =>
        set((state) => ({
            ...state,
            download: { ...state.download, current },
        })),

    updateDownloadProgress: (progress) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                current: state.download.current ? { ...state.download.current, progress } : null,
            },
        })),

    updateDownloadSpeed: (downloadBytesPerSec) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                current: state.download.current
                    ? { ...state.download.current, downloadBytesPerSec }
                    : null,
            },
        })),

    updateCurrentDownloadedSize: (bytes) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                current: state.download.current
                    ? { ...state.download.current, downloadedSize: bytes }
                    : null,
            },
        })),

    updateDownloadedFilesCount: (count) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                current: state.download.current
                    ? { ...state.download.current, currentFile: count }
                    : null,
            },
        })),

    addToDownloadQueue: (item) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                queue: [...state.download.queue, item],
            },
        })),

    removeFromDownloadQueue: (pid) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                queue: state.download.queue.filter((item) => item.pid !== pid),
            },
        })),

    addToDownloadCompleted: (item) =>
        set((state) => ({
            ...state,
            download: {
                ...state.download,
                completed: [...state.download.completed, item],
            },
        })),

    setDownloadProcessing: (isProcessing) =>
        set((state) => ({
            ...state,
            download: { ...state.download, isProcessing },
        })),

    clearDownloadCompleted: () =>
        set((state) => ({
            ...state,
            download: { ...state.download, completed: [] },
        })),

    abortDownload: () => {
        const { download } = get();
        if (download.current?.abortController) {
            download.current.abortController.abort();
        }
    },

    addToGamebananaCurrent: (item) =>
        set((state) => ({
            ...state,
            gamebanana: {
                ...state.gamebanana,
                current: [...state.gamebanana.current, item],
            },
        })),

    updateGamebananaCurrent: (pid, updates) =>
        set((state) => ({
            ...state,
            gamebanana: {
                ...state.gamebanana,
                current: state.gamebanana.current.map((item) =>
                    item.pid === pid ? { ...item, ...updates } : item,
                ),
            },
        })),

    removeFromGamebananaCurrent: (pid) =>
        set((state) => ({
            ...state,
            gamebanana: {
                ...state.gamebanana,
                current: state.gamebanana.current.filter((item) => item.pid !== pid),
            },
        })),

    addToGamebananaCompleted: (item) =>
        set((state) => ({
            ...state,
            gamebanana: {
                ...state.gamebanana,
                completed: [...state.gamebanana.completed, item],
            },
        })),

    setGamebananaProcessing: (isProcessing) =>
        set((state) => ({
            ...state,
            gamebanana: { ...state.gamebanana, isProcessing },
        })),

    clearGamebananaCompleted: () =>
        set((state) => ({
            ...state,
            gamebanana: { ...state.gamebanana, completed: [] },
        })),

    reset: () => set(initialState),

    setSheetOpen: (v: boolean) =>
        set((state) => ({
            ...state,
            sheetOpen: v,
        })),
}));

export const useAkashaStore = () => useStore(akashaStore);
