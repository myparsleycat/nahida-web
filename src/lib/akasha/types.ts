export type ProcessStatus =
    | "pending"
    | "creating-directory"
    | "hash-calculation"
    | "uploading"
    | "paused"
    | "completed"
    | "failed";

export interface FileProgress {
    path: string;
    name: string;
    size: number;
    status: "pending" | "uploading" | "completed" | "failed";
    uploadedBytes?: number;
    uploadSpeed?: number;
}

export interface CurrentProcess {
    pid: string;
    name: string;
    status: ProcessStatus;
    totalItems: number;
    processedItems: number;
    uploadedBytes: number;
    totalBytes: number;
    uploadBytesPerSec: number;
    files?: FileProgress[];
    size: number;
    directories?: {
        path: string;
        name: string;
        status: "pending" | "created" | "failed";
    }[];

    parentUUID?: string;
    rawFiles?: import("@/lib/workers/akasha.worker").FileInfoComponent[];
    rawDirectories?: import("@/lib/workers/akasha.worker").DirectoryInfo[];
    error?: string;
}

export interface QueuedProcess {
    files: import("@/lib/workers/akasha.worker").FileInfoComponent[];
    directories: import("@/lib/workers/akasha.worker").DirectoryInfo[];
    pid: string;
    parentUUID?: string;
    name: string;
    size: number;
    totalItems: number;
    settings?: {
        removeDISABLED?: boolean;
    };
}

export interface CompleteProcess {
    pid: string;
    name: string;
    size: number;
}

export type DownloadCurrentStatus = "pending" | "downloading" | "completed";
export type GamebananaCurrentStatus = "pending" | "pulling" | "completed";

export interface UploadState {
    current: CurrentProcess | null;
    queue: QueuedProcess[];
    completed: CompleteProcess[];
    isProcessing: boolean;
}

export interface DownloadCurrent {
    pid: string;
    itemId: string;
    linkId?: string;
    token?: string;
    status: DownloadCurrentStatus;
    name: string;
    downloadedSize: number;
    totalSize: number;
    currentFile: number;
    totalFiles: number;
    progress: number;
    downloadBytesPerSec: number;
    download: {
        totalBytes: number;
        files: {
            id: string;
            fileId: string;
            parentId: string | null;
            name: string;
            size: number;
            compAlg: "gzip" | "zstd" | null;
            url: string;
        }[];
        dirs: {
            id: string;
            parentId: string | null;
            name: string;
        }[];
    };
    abortController: AbortController;
}

export interface DownloadQueue {
    pid: string;
    uuid: string;
    name: string;
    linkId?: string;
    token?: string;
}

export interface DownloadCompleted {
    pid: string;
    name: string;
    size: number;
}

export interface DownloadState {
    current: DownloadCurrent | null;
    queue: DownloadQueue[];
    completed: DownloadCompleted[];
    isProcessing: boolean;
}

export interface GamebananaCurrent {
    pid: string;
    status: GamebananaCurrentStatus;
    name: string;
    parentId: string;
}

export interface GamebananaCompleted {
    pid: string;
    name: string;
    parentId: string;
}

export interface GamebananaState {
    current: GamebananaCurrent[];
    completed: GamebananaCompleted[];
    isProcessing: boolean;
}

export interface AkashaQueueState {
    upload: UploadState;
    download: DownloadState;
    gamebanana: GamebananaState;
    sheetOpen: boolean;
}

export interface AkashaQueueActions {
    setUpload: (upload: UploadState) => void;
    setUploadCurrent: (current: CurrentProcess | null) => void;
    updateUploadStatus: (status: ProcessStatus, error?: string) => void;
    addToUploadQueue: (process: QueuedProcess) => void;
    removeFromUploadQueue: (pid: string) => void;
    addToUploadCompleted: (process: CompleteProcess) => void;
    setUploadProcessing: (isProcessing: boolean) => void;
    completeUpload: ({ pid, name, size }: { pid: string; name: string; size: number }) => void;
    clearUploadCompleted: () => void;

    setDownload: (download: DownloadState) => void;
    setDownloadCurrent: (current: DownloadCurrent | null) => void;
    updateDownloadProgress: (progress: number) => void;
    updateDownloadSpeed: (downloadBytesPerSec: number) => void;
    updateCurrentDownloadedSize: (bytes: number) => void;
    updateDownloadedFilesCount: (count: number) => void;
    addToDownloadQueue: (item: DownloadQueue) => void;
    removeFromDownloadQueue: (pid: string) => void;
    addToDownloadCompleted: (item: DownloadCompleted) => void;
    setDownloadProcessing: (isProcessing: boolean) => void;
    clearDownloadCompleted: () => void;
    abortDownload: () => void;

    addToGamebananaCurrent: (item: GamebananaCurrent) => void;
    updateGamebananaCurrent: (pid: string, updates: Partial<GamebananaCurrent>) => void;
    removeFromGamebananaCurrent: (pid: string) => void;
    addToGamebananaCompleted: (item: GamebananaCompleted) => void;
    setGamebananaProcessing: (isProcessing: boolean) => void;
    clearGamebananaCompleted: () => void;

    reset: () => void;
    setSheetOpen: (v: boolean) => void;
}

export interface ContentPreview {
    img?: {
        default: string;
        cover: string | null;
        thumbnail: string | null;
    };
    video?: {
        default: string;
    };
}

export type Content = {
    id: string;
    name: string;
    isDir: boolean;
    size: number | null;
    mimeType: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    preview?: ContentPreview | null;
    link?: {
        id: string;
        password: boolean;
        expiresAt: Date | null;
        url: string;
    } | null;
    cachedSrc?: string;
};

export type SortType =
    | "NAME:DESC"
    | "NAME:ASC"
    | "SIZE:DESC"
    | "SIZE:ASC"
    | "DATE:DESC"
    | "DATE:ASC";

export type QueuedUpload = {
    files: import("@/lib/workers/akasha.worker").FileInfoWorker[];
    directories: import("@/lib/workers/akasha.worker").DirectoryInfo[];
    processId: string;
};

export type LayoutType = "grid" | "list";
