import type {
    CreateDirAction,
    DeleteManyAction,
    DownloadFileAction,
    ErrorMessage,
    ProgressMessage,
    RestoreManyAction,
    TrashManyAction,
    UploadFileAction,
    UploadFileCompleteMessage,
    WorkerAction,
} from "./types";

import { eden } from "../eden";
import { normalizePath } from "../utils";
import {
    handleCreateDir,
    handleDeleteMany,
    handleDownloadFile,
    handleRestoreMany,
    handleTrashMany,
} from "./handlers";
import { Semaphore } from "./semaphore";
import { processUpload } from "./upload/orchestrator";
import { SpeedMonitor } from "./upload/speed-monitor";

export type {
    FileInfoComponent,
    FileInfoWorker,
    DirectoryInfo,
    WorkerMessage,
    CreateDirCompleteMessage,
    DownloadFileCompleteMessage,
    DownloadDirComplateMessage,
    XHRDownloaderComplete,
    XHRDownloaderProgress,
    DownloadDirDataMessage,
    DrawThumbnailAction,
} from "./types";

const semaphore = new Semaphore(8);
const dirIdMap = new Map<string, string>();

async function handleUploadFile(action: UploadFileAction) {
    const { name, files, maxBytes, maxConnections, pid, parentUUID } = action;
    const uploadedFiles: string[] = [];

    try {
        const totalFiles = files.length;
        let completedFileCount = 0;
        let uid: string | null = null;

        if (totalFiles >= 5) {
            try {
                const { data, error } = await eden.akasha.drive.upload.init.post({
                    current: parentUUID,
                });

                if (!error) {
                    uid = data;
                }
            } catch {}
        }

        self.postMessage({
            pid,
            type: "progress",
            action: "upload_file",
            current: 0,
            total: totalFiles,
            success: true,
        } as ProgressMessage);

        const filesWithParentId = files.map((file) => {
            const parentPathNormalized = normalizePath(file.parentPath);
            let parentId = dirIdMap.get(parentPathNormalized);

            if (!parentId) {
                console.warn(
                    `Parent directory ID not found for path: ${file.parentPath}. Assigning to root.`,
                );
                parentId = parentUUID;
            }

            return {
                ...file,
                parentId,
            };
        });

        const speedMonitor = new SpeedMonitor((msg) => self.postMessage(msg));

        await processUpload(filesWithParentId, {
            pid,
            current: parentUUID,
            compAlg: "zstd",
            speedMonitor,
            setStatus: (status, current, total) => {
                self.postMessage({
                    pid,
                    type: "progress",
                    action: "upload_file",
                    status,
                    success: true,
                    current,
                    total,
                } as ProgressMessage);
            },
            onFileUploaded: (FID: string) => {
                uploadedFiles.push(FID);
                completedFileCount++;
                self.postMessage({
                    pid,
                    type: "progress",
                    action: "upload_file",
                    current: completedFileCount,
                    success: true,
                } as ProgressMessage);
            },
        });

        if (uid) {
            try {
                await eden.akasha.webhook.event.post({
                    uid,
                    pName: name,
                });
            } catch {}
        }

        self.postMessage({
            type: "complete",
            action: "upload_file",
            success: true,
            name,
            uploadedFiles,
            pid,
            parentId: parentUUID,
        } as UploadFileCompleteMessage);
    } catch (err: any) {
        console.error("Error in handleUploadFile:", err);

        self.postMessage({
            type: "error",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error occurred",
            pid,
        } as ErrorMessage);
    }
}

self.onmessage = async (event: MessageEvent<WorkerAction>) => {
    try {
        switch (event.data.action) {
            case "create_dir":
                await handleCreateDir(event.data as CreateDirAction, semaphore, dirIdMap);
                break;
            case "trash_many":
                await handleTrashMany(event.data as TrashManyAction, semaphore);
                break;
            case "restore_many":
                await handleRestoreMany(event.data as RestoreManyAction, semaphore);
                break;
            case "delete_many":
                await handleDeleteMany(event.data as DeleteManyAction, semaphore);
                break;
            case "upload_file":
                await handleUploadFile(event.data as UploadFileAction);
                break;
            case "download:file":
                await handleDownloadFile(event.data as DownloadFileAction, semaphore);
                break;
            default:
                throw new Error(`Unknown action: ${(event.data as any).action}`);
        }
    } catch (err: any) {
        self.postMessage({
            type: "error",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error occurred",
        } as ErrorMessage);
    }
};
