import type { ProcessStatus } from "@/lib/akasha/types";

import { akashaStore } from "@/stores/akasha-queue.store";

const uploadTaskQueue: { message: any; transferList: Transferable[] }[] = [];

let akashaWorkerInstance: Worker | null = null;

export function setAkashaWorker(worker: Worker) {
    akashaWorkerInstance = worker;
}

export interface WorkerWrapper {
    worker: Worker;
    busy: boolean;
}

export function getAvailableWorker() {
    return akashaWorkerInstance;
}

export function assignTaskToWorker(message: any, transferList: Transferable[]) {
    const worker = getAvailableWorker();
    if (!worker) {
        throw new Error("cannot get available worker");
    }

    worker.postMessage(message, transferList);
}

export async function processNextUploadInQueue() {
    let store = akashaStore.getState();
    if (store.upload.isProcessing || store.upload.queue.length === 0) return;

    const nextUpload = store.upload.queue[0];

    store.setUploadProcessing(true);
    store.setUploadCurrent({
        pid: nextUpload.pid,
        parentUUID: nextUpload.parentUUID,
        rawFiles: nextUpload.files,
        rawDirectories: nextUpload.directories,
        name: nextUpload.name,
        status: "pending",
        totalItems: nextUpload.totalItems,
        processedItems: 0,
        uploadedBytes: 0,
        totalBytes: nextUpload.size,
        uploadBytesPerSec: 0,
        size: nextUpload.size,
        files: nextUpload.files.map((file) => ({
            path: file.path,
            name: file.name,
            size: file.size,
            status: "pending",
        })),
        directories: nextUpload.directories.map((dir) => ({
            path: dir.path,
            name: dir.name,
            status: "pending",
        })),
    });
    store.removeFromUploadQueue(nextUpload.pid);

    try {
        store = akashaStore.getState();
        const currentUpload = store.upload.current;
        if (!currentUpload) {
            throw new Error("curret upload is empty... why?");
        }

        if (currentUpload.rawDirectories && currentUpload.rawDirectories.length > 0) {
            assignTaskToWorker(
                {
                    action: "create_dir",
                    directories: currentUpload.rawDirectories,
                    parentUUID: currentUpload.parentUUID,
                    maxConcurrent: 8,
                    pid: currentUpload.pid,
                },
                [],
            );
        } else {
            const dirIdMap: Record<string, string> = { "": currentUpload.parentUUID ?? "" };
            assignTaskToWorker(
                {
                    action: "upload_file",
                    files: currentUpload.rawFiles ?? [],
                    name: currentUpload.name,
                    parentUUID: currentUpload.parentUUID,
                    dirIdMap,
                    maxBytes: 100 * 1024 * 1024,
                    maxConnections: 8,
                    pid: currentUpload.pid,
                },
                [],
            );
        }
    } catch (error) {
        console.error("Error processing upload:", error);
        updateCurrentUploadStatus(
            nextUpload.pid,
            "failed",
            error instanceof Error ? error.message : "Unknown error",
        );
        await completeCurrentUpload();
    }
}

export async function completeCurrentUpload() {
    let store = akashaStore.getState();
    const { current } = store.upload;

    if (!current) return;

    store.completeUpload({
        pid: current.pid,
        name: current.name,
        size: current.size,
    });

    store = akashaStore.getState();
    if (store.upload.queue.length > 0 && !store.upload.isProcessing) {
        await processNextUploadInQueue();
    }
}

export function updateCurrentUploadStatus(pid: string, status: ProcessStatus, error?: string) {
    let store = akashaStore.getState();
    if (!store.upload.current || store.upload.current.pid !== pid) return;

    store.updateUploadStatus(status, error);
}

export function processUploadQueue() {
    while (uploadTaskQueue.length > 0) {
        const worker = getAvailableWorker();
        if (!worker) break;
        const { message, transferList } = uploadTaskQueue.shift()!;
        if (message) {
            // workerWrapper.busy = true;
            worker.postMessage(message, transferList);
        }
    }
}

export function processNextTask() {
    if (uploadTaskQueue.length === 0) {
        return;
    }

    const worker = getAvailableWorker();
    if (!worker) {
        return;
    }

    const { message, transferList } = uploadTaskQueue.shift()!;
    worker.postMessage(message, transferList);
}
