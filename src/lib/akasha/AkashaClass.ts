import { t } from "i18next";
import ky from "ky";
import { nanoid } from "nanoid";
import { toast } from "sonner";

import type { WorkerMessage } from "@/lib/workers/akasha.worker";

import { contentDragStore } from "@/hooks/akasha";
import { queryClient } from "@/integrations/queryClient";
import { eden } from "@/lib/eden";
import i18n from "@/lib/i18n";
import { Decompressor, normalizePath, validateExt } from "@/lib/utils";
import akashaWorker from "@/lib/workers/akasha.worker?worker";
import { dialogStore } from "@/stores/akasha-dialog.store";
import { akashaStore } from "@/stores/akasha-queue.store";

import type { Content, QueuedProcess } from "./types";

import { completeCurrentDownload, processNextDownloadInQueue } from "./services/download";
import { collectDirectoryStructure, collectFiles, isNameConflict, saveFile } from "./services/fs";
import { setting } from "./services/setting";
import {
    assignTaskToWorker,
    completeCurrentUpload,
    processNextTask,
    processNextUploadInQueue,
    processUploadQueue,
    setAkashaWorker,
    updateCurrentUploadStatus,
} from "./services/upload";

class AkashaClass {
    private _store?: ReturnType<typeof akashaStore.getState>;
    private _dialog?: ReturnType<typeof dialogStore.getState>;
    private _drag?: ReturnType<typeof contentDragStore.getState>;
    public worker: Worker | null = null;

    constructor() {
        this.createWorker();
        this.setupWorkerHandlers();
    }

    public get store() {
        if (!this._store) {
            this._store = akashaStore.getState();
        }
        return this._store;
    }

    public get dialog() {
        if (!this._dialog) {
            this._dialog = dialogStore.getState();
        }
        return this._dialog;
    }

    public get drag() {
        if (!this._drag) {
            this._drag = contentDragStore.getState();
        }
        return this._drag;
    }

    createWorker() {
        this.worker = new akashaWorker();
        setAkashaWorker(this.worker);
    }

    setupWorkerHandlers() {
        const worker = this.worker;
        if (!worker) {
            throw new Error("worker is not initlized");
        }

        worker.onmessage = (e: MessageEvent) => {
            const message = e.data as WorkerMessage;
            const store = akashaStore.getState();

            let workIsDone = false;

            switch (message.type) {
                case "progress":
                    if (message.pid) {
                        switch (message.action) {
                            case "create_dir":
                                if (
                                    store.upload.current &&
                                    store.upload.current.pid === message.pid
                                ) {
                                    store.setUploadCurrent({
                                        ...store.upload.current,
                                        status: "creating-directory",
                                        processedItems: message.current,
                                    });
                                }
                                break;

                            case "upload_file":
                                if (
                                    store.upload.current &&
                                    store.upload.current.pid === message.pid
                                ) {
                                    store.setUploadCurrent({
                                        ...store.upload.current,
                                        ...(message.status != null && { status: message.status }),
                                        ...(message.current != null && {
                                            processedItems: message.current,
                                        }),
                                        ...(message.total != null && { totalItems: message.total }),
                                        ...(message.bytesUploaded != null && {
                                            uploadedBytes: message.bytesUploaded,
                                        }),
                                        ...(message.totalBytes != null && {
                                            totalBytes: message.totalBytes,
                                        }),
                                    });
                                }
                                break;

                            case "upload_speed":
                                if (
                                    store.upload.current &&
                                    store.upload.current.pid === message.pid
                                ) {
                                    store.setUploadCurrent({
                                        ...store.upload.current,
                                        ...(message.uploadBytesPerSec != null && {
                                            uploadBytesPerSec: message.uploadBytesPerSec,
                                        }),
                                    });
                                }
                                break;
                        }
                    }
                    break;

                case "complete":
                    switch (message.action) {
                        case "create_dir": {
                            if (store.upload.current && store.upload.current.pid === message.pid) {
                                const currentUpload = store.upload.current;
                                if (!currentUpload) break;

                                const dirIdMap: Record<string, string> = {
                                    "": currentUpload.parentUUID ?? "",
                                };
                                message.createdDirectories.forEach(
                                    (uuid: string, index: number) => {
                                        if (
                                            currentUpload.rawDirectories &&
                                            index < currentUpload.rawDirectories.length
                                        ) {
                                            const dir = currentUpload.rawDirectories[index];
                                            const normalizedPath = normalizePath(dir.path);
                                            dirIdMap[normalizedPath] = uuid;
                                        }
                                    },
                                );

                                assignTaskToWorker(
                                    {
                                        action: "upload_file",
                                        files: currentUpload.rawFiles ?? [],
                                        dirIdMap,
                                        parentUUID: currentUpload.parentUUID,
                                        name: currentUpload.name,
                                        maxBytes: 50 * 1024 * 1024,
                                        maxConnections: 50,
                                        pid: currentUpload.pid,
                                    },
                                    [],
                                );
                            }
                            break;
                        }

                        case "upload_file":
                            updateCurrentUploadStatus(message.pid, "completed");
                            toast.success(`업로드 완료: ${message.name}`);
                            queryClient.refetchQueries({
                                queryKey: ["akasha", "drive", "item", message.parentId],
                            });
                            completeCurrentUpload();
                            break;

                        case "trash_many":
                            const trashed = message.trashedUUIDs;
                            toast.success(
                                `${trashed.length}개의 파일 및 디렉토리가 휴지통으로 이동되었습니다`,
                            );
                            queryClient.refetchQueries({
                                queryKey: ["akasha", "drive", "item"],
                            });
                            break;

                        case "restore_many":
                            toast.success(
                                `${message.restoredUUIDs.length}개의 파일 및 디렉토리가 복원되었습니다`,
                            );
                            queryClient.refetchQueries({
                                queryKey: ["akasha", "drive", "item"],
                            });
                            break;

                        case "delete_many":
                            const deleted = message.deletedUUIDs;
                            toast.success(
                                `${deleted.length}개의 파일 및 디렉토리가 삭제되었습니다`,
                            );
                            queryClient.refetchQueries({
                                queryKey: ["akasha", "drive", "item"],
                            });

                            break;
                    }
                    workIsDone = true;
                    break;

                case "resolveWorker":
                    workIsDone = true;
                    break;

                case "error":
                    if (message.pid) {
                        if (store.upload.current && store.upload.current.pid === message.pid) {
                            updateCurrentUploadStatus(message.pid, "failed", message.error);
                            completeCurrentUpload();
                        }
                    }
                    console.error("Worker error:", message);
                    workIsDone = true;
                    break;
            }

            if (workIsDone) {
                processUploadQueue();
                processNextTask();
            }
        };
    }

    async refetch(props?: { itemId?: string }) {
        await queryClient.refetchQueries({
            queryKey: props?.itemId
                ? ["akasha", "drive", "item", props.itemId]
                : ["akasha", "drive", "item"],
        });
    }

    changeTransferSheetOpen(v: boolean) {
        if (setting.sheet_open) {
            this.store.setSheetOpen(v);
        }
    }

    copyId(item: Content) {
        navigator.clipboard.writeText(item.id).then(() => {
            toast.success(t("drive.toast.copied_to_clipboard"));
        });
    }

    async clearPrefix(id: string, name: string) {
        const DoIt = await this.dialog.showDialog("clearPrefixDialog", { id, name });
        if (!DoIt) return;

        const promise = async () => {
            const { data, error } = await eden.akasha.content.ut.clear_prefix({ id }).post();

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        };

        toast.promise(promise, {
            loading: "접두사 정리중...",
            success: (res) => {
                if (res > 0) {
                    return `${res}개 항목에서 DISABLED를 제거했습니다`;
                } else {
                    return "접두사가 정리된 항목이 없습니다";
                }
            },
            error: (err: any) => err,
            finally: () => {
                this.dialog.setOpen("clearPrefixDialog", false);
            },
        });
    }

    DLProcess = {
        enqueueDownload({
            uuid,
            name,
            linkId,
            token,
        }: {
            uuid: string;
            name: string;
            linkId?: string;
            token?: string;
        }) {
            const pid = nanoid();
            const queuedDownload = { pid, uuid, name, linkId, token };

            const store = akashaStore.getState();
            store.addToDownloadQueue(queuedDownload);

            if (!store.download.current) {
                this.processNextDownloadInQueue();
            }
        },

        async processNextDownloadInQueue() {
            await processNextDownloadInQueue();
        },

        CancelDownload(pid: string) {
            const { download, removeFromDownloadQueue } = akashaStore.getState();

            if (download.current && download.current.pid === pid) {
                download.current.abortController.abort();
                completeCurrentDownload();
            } else {
                removeFromDownloadQueue(pid);
            }
        },
    };

    ULProcess = {
        enqueueUpload: (upload: Omit<QueuedProcess, "pid">) => {
            const pid = nanoid();
            const queuedUpload = { ...upload, pid };

            this.store.addToUploadQueue(queuedUpload);

            if (!this.store.upload.isProcessing && !this.store.upload.current) {
                processNextUploadInQueue();
            }

            return pid;
        },

        CancelUpload(pid: string) {
            const { upload, removeFromUploadQueue } = akashaStore.getState();

            if (upload.current && upload.current.pid === pid) {
                // upload.current.abortController.abort();
            } else {
                removeFromUploadQueue(pid);
            }
        },
    };

    async uploadFromEntries(items: Content[], entries: FileSystemEntry[], current: string) {
        const directories = entries.filter(
            (entry): entry is FileSystemDirectoryEntry => entry.isDirectory,
        );

        if (entries.length === 1 && entries[0].isFile) {
            const fileEntry = entries[0] as FileSystemFileEntry;
            const file = await new Promise<File>((resolve, reject) => {
                fileEntry.file(resolve, reject);
            });
            if (!validateExt(file.name)) {
                toast.warning(`${i18n.t("drive.not_validateExt.0")}`, {
                    description: `${i18n.t("drive.not_validateExt.1")}`,
                });
                return;
            }
        }

        const collectedFiles = await Promise.all(entries.map((entry) => collectFiles(entry)));
        const allFiles = collectedFiles.flat();

        const collectedDirs = await Promise.all(
            directories.map((dir) => collectDirectoryStructure(dir)),
        );
        const allDirectories = collectedDirs.flat();

        let processName: string;
        if (entries.length === 1) {
            processName = entries[0].name;
        } else {
            const sortedFolderNames = directories
                .map((dir) => dir.name)
                .sort((a, b) => b.localeCompare(a));
            if (sortedFolderNames.length > 0) {
                const totalItems = entries.length - 1;
                processName = `${sortedFolderNames[0]} 외 ${totalItems}개`;
            } else {
                processName = `${entries[0].name} 외 ${entries.length - 1}개`;
            }
        }

        const totalSize = allFiles.reduce((sum, fileInfo) => sum + fileInfo.file.size, 0);

        if (isNameConflict(items, processName)) {
            this.drag.setUploadDragging(false);
            const shouldMerge = await this.dialog.showDialog("conflictNameDialog");
            if (!shouldMerge) {
                return;
            }
        }

        this.ULProcess.enqueueUpload({
            files: allFiles,
            directories: allDirectories,
            parentUUID: current,
            name: processName,
            size: totalSize,
            totalItems: allDirectories.length || allFiles.length,
        });
        this.changeTransferSheetOpen(true);
    }

    async trashMany(ids: string[]) {
        const { data, error } = await eden.akasha.content.trash.trash_many.post({
            uuids: ids,
        });

        if (error) {
            throw new Error(error.value.toString());
        }

        return data;
    }

    async restoreMany(ids: string[]) {
        const { data, error } = await eden.akasha.content.trash.restore_many.post({
            uuids: ids,
        });

        if (error) {
            throw new Error(error.value.toString());
        }

        return data;
    }

    async deleteMany(ids: string[]) {
        const { data, error } = await eden.akasha.content.delete_many.post({
            uuids: ids,
        });

        if (error) {
            throw new Error(error.value.toString());
        }

        return data;
    }

    async empty() {
        const { data, error } = await eden.akasha.content.trash.empty.post();

        if (error) {
            throw new Error(error.value.toString());
        }

        return data;
    }

    item(item: Content) {
        return {
            download: async (props?: { linkId?: string; token?: string }) => {
                const { linkId, token } = props || {};

                if (item.isDir) {
                    if (item.size && item.size > 100 * 1024 * 1024 * 1024) {
                        toast.warning(t("toast.browser_download_too_large.title"), {
                            description: t("toast.browser_download_too_large.description"),
                        });
                        return;
                    }

                    this.DLProcess.enqueueDownload({
                        uuid: item.id,
                        name: item.name,
                        linkId,
                        token,
                    });
                } else {
                    const { data, error } = await eden.akasha.file.download.get({
                        query: {
                            uuid: item.id,
                            response: "json",
                            ...(linkId && { linkId }),
                        },
                        headers: {
                            ...(token && { "nhd-link-token": token }),
                        },
                    });

                    if (error) {
                        throw new Error(error.value.toString());
                    }

                    const downloadPromise = ky.get(data.url, { cache: "no-store" }).arrayBuffer();
                    toast.promise(downloadPromise, {
                        loading: "파일 다운로드중...",
                    });

                    const rawFile = await downloadPromise;

                    let decomp: Uint8Array;

                    if (data.compAlg === "gzip" || data.compAlg === "zstd") {
                        decomp = await Decompressor(new Uint8Array(rawFile), data.compAlg);
                    } else {
                        decomp = new Uint8Array(rawFile);
                    }

                    await saveFile(decomp, item.name);
                }
            },
        };
    }
}

export const akasha = new AkashaClass();
