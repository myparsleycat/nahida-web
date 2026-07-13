import { throttle } from "es-toolkit/function";
import { t } from "i18next";
import { toast } from "sonner";

import { akashaStore } from "@/stores/akasha-queue.store";

import { countBundleEntries, downloadBundlesToOpfs } from "./bundle-download";
import {
    startStreamingDownload,
    getDriveDownloadUrl,
    buildDriveSseHeaders,
    type StreamedMetadata,
} from "./download-core";
import {
    createOpfsDirectories,
    downloadFilesToOpfs,
    ensureBrowserOpfsDownloadSupport,
    prepareOpfsDownloadDirectory,
    removeOpfsDirectory,
    triggerStreamingZipDownload,
    writeNahidaMetadataFile,
} from "./opfs-download";

type DownloadMetadata = StreamedMetadata;

export async function getDownloadUrls({
    uuid,
    linkId,
    token,
    signal,
}: {
    uuid: string;
    linkId?: string;
    token?: string;
    signal?: AbortSignal;
}) {
    const url = getDriveDownloadUrl({ uuid, linkId });
    const headers = buildDriveSseHeaders({ token });

    return startStreamingDownload({
        url,
        headers,
        abortSignal: signal || new AbortController().signal,
    });
}

export async function completeCurrentDownload() {
    const store = akashaStore.getState();
    const { current, completed } = store.download;
    if (!current) return;

    const completedDownload = {
        pid: current.pid,
        name: current.name,
        size: current.totalSize,
    };

    store.setDownload({
        ...store.download,
        completed: [...completed, completedDownload],
        isProcessing: false,
        current: null,
    });

    if (store.download.queue.length > 0) {
        await processNextDownloadInQueue();
    }
}

export async function processNextDownloadInQueue() {
    const store = akashaStore.getState();
    if (store.download.isProcessing || store.download.queue.length === 0) return;

    const nextDownload = store.download.queue[0];
    const { pid, uuid, name, linkId, token } = nextDownload;

    try {
        await ensureBrowserOpfsDownloadSupport();
    } catch (error: unknown) {
        toast.warning(error instanceof Error ? error.message : String(error));
        store.removeFromDownloadQueue(pid);
        return;
    }

    const abortController = new AbortController();
    store.removeFromDownloadQueue(pid);
    store.setDownloadProcessing(true);
    store.setDownloadCurrent({
        pid,
        itemId: uuid,
        name,
        linkId,
        token,
        status: "pending",
        downloadedSize: 0,
        totalSize: 0,
        currentFile: 0,
        totalFiles: 0,
        progress: 0,
        downloadBytesPerSec: 0,
        download: { totalBytes: 0, files: [], dirs: [] },
        abortController,
    });

    const getDownloadUrlsPromise = getDownloadUrls({
        uuid,
        linkId,
        token,
        signal: abortController.signal,
    });

    toast.promise(getDownloadUrlsPromise, {
        loading: t("drive.#.processNextDownloadInQueue.toast-promise.loading"),
        error: (err: any) =>
            `${t("drive.#.processNextDownloadInQueue.toast-promise.error", { values: { error: err.message } })}`,
    });

    try {
        const downloadInfo = await getDownloadUrlsPromise;

        store.setDownloadCurrent({
            pid,
            itemId: uuid,
            name,
            linkId,
            token,
            status: "downloading",
            downloadedSize: 0,
            totalSize: downloadInfo.totalBytes,
            currentFile: 0,
            totalFiles: downloadInfo.files.length + countBundleEntries(downloadInfo.bundles),
            progress: 0,
            downloadBytesPerSec: 0,
            download: {
                totalBytes: downloadInfo.totalBytes,
                files: downloadInfo.files,
                dirs: downloadInfo.dirs,
            },
            abortController,
        });

        await startDownload({
            uuid,
            name,
            linkId,
            token,
            download: downloadInfo,
            abortSignal: abortController.signal,
        });
    } catch (error) {
        store.setDownload({
            ...store.download,
            current: null,
            isProcessing: false,
        });
        if (akashaStore.getState().download.queue.length > 0) {
            await processNextDownloadInQueue();
        }
        throw error;
    }
}

export async function startDownload(params: {
    uuid: string;
    name: string;
    linkId?: string;
    token?: string;
    download?: DownloadMetadata;
    abortSignal: AbortSignal;
}) {
    const { uuid, name, linkId, token, abortSignal } = params;
    const store = akashaStore.getState();
    let directoryName: string | null = null;

    try {
        store.setSheetOpen(true);

        await ensureBrowserOpfsDownloadSupport();

        const download =
            params.download ??
            (await startStreamingDownload({
                url: getDriveDownloadUrl({ uuid, linkId }),
                headers: buildDriveSseHeaders({ token }),
                abortSignal,
            }));

        const {
            directoryName: tempDirectoryName,
            rootHandle,
            suggestedName,
        } = await prepareOpfsDownloadDirectory({
            itemId: uuid,
            itemName: name,
            kind: linkId ? "link" : "drive",
        });
        directoryName = tempDirectoryName;

        const { totalBytes, dirs, files, bundles, root, mtd } = download;
        const dirHandles = await createOpfsDirectories(dirs, root, rootHandle);

        const mtdContent = mtd
            ? `${mtd.type}:${mtd.dirId}:${mtd.timestamp}:${mtd.key}:${mtd.forbiddenKnowledge}`
            : null;
        if (mtdContent) {
            await writeNahidaMetadataFile({
                files,
                dirHandles,
                rootHandle,
                content: mtdContent,
            });
        }

        let downloadedBytes = 0;
        let downloadedCount = 0;
        let speedBytesThisSecond = 0;

        const throttledUpdateProgress = throttle((percent: number) => {
            store.updateDownloadProgress(percent);
        }, 100);

        const speedInterval = setInterval(() => {
            store.updateDownloadSpeed(speedBytesThisSecond);
            speedBytesThisSecond = 0;
        }, 1000);

        try {
            const standaloneResults = await downloadFilesToOpfs({
                files,
                dirHandles,
                rootHandle,
                abortSignal,
                progress: {
                    updateDownloadedBytes: (bytes) => {
                        downloadedBytes += bytes;
                        store.updateCurrentDownloadedSize(downloadedBytes);
                        throttledUpdateProgress(
                            Math.min((downloadedBytes / Math.max(totalBytes, 1)) * 100, 100),
                        );
                    },
                    updateSpeed: (bytes) => {
                        speedBytesThisSecond += bytes;
                    },
                    fileCompleted: () => {
                        downloadedCount++;
                        store.updateDownloadedFilesCount(downloadedCount);
                    },
                },
            });
            const bundleResults = await downloadBundlesToOpfs({
                bundles,
                dirHandles,
                rootHandle,
                abortSignal,
                progress: {
                    updateDownloadedBytes: (bytes) => {
                        downloadedBytes += bytes;
                        store.updateCurrentDownloadedSize(downloadedBytes);
                        throttledUpdateProgress(
                            Math.min((downloadedBytes / Math.max(totalBytes, 1)) * 100, 100),
                        );
                    },
                    updateSpeed: (bytes) => {
                        speedBytesThisSecond += bytes;
                    },
                    fileCompleted: () => {
                        downloadedCount++;
                        store.updateDownloadedFilesCount(downloadedCount);
                    },
                },
            });

            const failedResults = [...standaloneResults, ...bundleResults].filter(
                (result) => result.status === "rejected",
            );
            if (failedResults.length > 0) {
                console.error(
                    `${failedResults.length}개 파일 다운로드 실패:`,
                    failedResults.map((result) => result.reason),
                );
                throw new Error(`${failedResults.length}개 파일 다운로드 실패`);
            }

            triggerStreamingZipDownload({
                directoryName,
                fileName: suggestedName,
            });
            toast.success(t("g.download_complete"), { description: name });
        } finally {
            clearInterval(speedInterval);
            store.updateDownloadSpeed(0);
        }
    } catch (err: unknown) {
        console.error("Download preparation error:", err);

        if (directoryName) {
            try {
                await removeOpfsDirectory(directoryName);
            } catch (cleanupErr) {
                console.warn("Failed to clean OPFS directory after download failure:", cleanupErr);
            }
        }

        if (!(err instanceof Error && err.name === "AbortError")) {
            toast.error(t("g.download_failed"), {
                description: err instanceof Error ? err.message : String(err),
            });
        }
    } finally {
        await completeCurrentDownload();
    }
}
