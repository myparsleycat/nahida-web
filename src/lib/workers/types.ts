import type { Treaty } from "@elysiajs/eden";

import type { dirsT, filesT } from "@/types";

import type { ProcessStatus } from "../akasha";

import { eden } from "../eden";

// Re-export for convenience
export type { ProcessStatus };

const $fileCreateMany = eden.akasha.file.create_many.post;
export type CreateManyResults = Treaty.Data<typeof $fileCreateMany>;

// File/Directory Info Types
export type FileInfoComponent = {
    FID: string;
    clientId: string;
    path: string;
    name: string;
    size: number;
    parentPath: string;
    file: File;
};

export type FileInfoWorker = {
    FID: string;
    clientId: string;
    path: string;
    name: string;
    size: number;
    parentPath: string;
    parentId: string;
    file: File;
};

export type DirectoryInfo = {
    path: string;
    name: string;
    parentPath: string;
};

// Action Types
export type InitAction = {
    action: "init";
    PUBLIC_ORIGIN: string;
};

export type UploadFileAction = {
    pid: string;
    action: "upload_file";
    files: FileInfoWorker[];
    name: string;
    parentUUID: string;
    dirIdMap: Record<string, string>;
    maxBytes: number;
    maxConnections: number;
};

export type CreateDirAction = {
    action: "create_dir";
    directories: DirectoryInfo[];
    parentUUID: string;
    maxConcurrent: number;
    pid: string;
};

export type TrashManyAction = {
    action: "trash_many";
    parentId: string;
    uuids: string[];
};

export type RestoreManyAction = {
    action: "restore_many";
    parentId: string;
    uuids: string[];
};

export type DeleteManyAction = {
    action: "delete_many";
    uuids: string[];
};

export type DownloadFileAction = {
    action: "download:file";
    uuid: string;
    name: string;
};

export type DownloadDirAction = {
    action: "download:dir";
    dirHandle: FileSystemDirectoryHandle;
    uuid: string;
};

export type GetSizeAction = {
    action: "get_size";
    uuid: string;
    linkId: string | null;
    password: string | null;
};

export type XHRDownloaderAction = {
    action: "XHRDownloader";
    pid: string;
    url: string;
};

export type DrawThumbnailAction = {
    action: "draw_thumbnail";
    canvas: OffscreenCanvas;
    src: string;
    width: number;
    height: number;
};

// Message Types
type BaseMessage = {
    success: boolean;
};

export type ProgressMessage = BaseMessage & {
    type: "progress";
    action: "create_dir" | "upload_file" | "upload_speed";
    status: ProcessStatus;
    pid: string;
    current: number;
    total: number;
    path?: string;
    bytesUploaded: number;
    totalBytes: number;
    uploadBytesPerSec: number;
};

export type UploadFileCompleteMessage = BaseMessage & {
    type: "complete";
    action: "upload_file";
    pid: string;
    name: string;
    uploadedFiles: string[];
    parentId: string;
};

export type CreateDirCompleteMessage = BaseMessage & {
    type: "complete";
    action: "create_dir";
    pid: string;
    createdDirectories: string[];
};

export type TrashManyCompleteMessage = BaseMessage & {
    type: "complete";
    action: "trash_many";
    pid: string;
    trashedUUIDs: string[];
};

export type RestoreManyCompleteMessage = BaseMessage & {
    type: "complete";
    action: "restore_many";
    pid: string;
    restoredUUIDs: string[];
};

export type DeleteManyCompleteMessage = BaseMessage & {
    type: "complete";
    action: "delete_many";
    pid: string;
    deletedUUIDs: string[];
};

export type DownloadFileCompleteMessage = BaseMessage & {
    type: "complete";
    action: "download:file";
    pid?: string;
    uuid: string;
    name: string;
    url: string;
    compAlg: string | null;
};

export type DownloadDirComplateMessage = BaseMessage & {
    type: "complate";
    action: "download:dir";
    pid: string;
    uuid: string;
    name: string;
};

export type XHRDownloaderComplete = BaseMessage & {
    type: "complete";
    action: "XHRDownloader";
    pid: string;
    fileData: Uint8Array;
};

export type XHRDownloaderProgress = {
    pid: string;
};

export type DownloadDirDataMessage = BaseMessage & {
    type: "data";
    action: "download_dirs";
    pid: string;
    data: {
        files: filesT[];
        dirs: dirsT[];
    };
};

type V2XHRDownloaderOngrogressData = {
    pid: string;
    delta: number;
};

type V2XHRDownloaderOncompleteData = {
    pid: string;
    data: ArrayBuffer;
};

type V2 = {
    type: "v2";
    action: "XHRDownloader:ongrogress" | "XHRDownloader:oncomplete";
    data: V2XHRDownloaderOngrogressData | V2XHRDownloaderOncompleteData;
};

type ResolveWorker = { type: "resolveWorker" };

export type ErrorMessage = BaseMessage & {
    type: "error";
    pid?: string;
    error: string;
};

// Union Types
export type WorkerAction =
    | InitAction
    | CreateDirAction
    | TrashManyAction
    | RestoreManyAction
    | DeleteManyAction
    | UploadFileAction
    | DownloadFileAction
    | DownloadDirAction
    | GetSizeAction
    | XHRDownloaderAction
    | DrawThumbnailAction;

export type CompleteMessage =
    | CreateDirCompleteMessage
    | TrashManyCompleteMessage
    | RestoreManyCompleteMessage
    | DeleteManyCompleteMessage
    | DownloadFileCompleteMessage
    | UploadFileCompleteMessage
    | XHRDownloaderComplete;

export type WorkerMessage = ProgressMessage | CompleteMessage | ErrorMessage | V2 | ResolveWorker;
