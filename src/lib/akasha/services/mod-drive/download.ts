import { throttle } from "es-toolkit/function";
import i18n, { t } from "i18next";
import { toast } from "sonner";

import type { Content } from "@/lib/akasha/types";

import { modStore } from "@/stores/akasha-mod.store";
import { globalStore } from "@/stores/global.store";

import type { AkashaModData } from "../drive-types";

import {
    startStreamingDownload,
    getModDownloadUrl,
    buildModSseHeaders,
    startDesktopDownload,
} from "../download-core";
import {
    createOpfsDirectories,
    downloadFilesToOpfs,
    ensureBrowserOpfsDownloadSupport,
    prepareOpfsDownloadDirectory,
    removeOpfsDirectory,
    triggerStreamingZipDownload,
    writeNahidaMetadataFile,
} from "../opfs-download";

export async function getDownloadUrls({
    itemId,
    signal,
    token,
    sig,
}: {
    itemId: string;
    signal?: AbortSignal;
    token?: string;
    sig?: string;
}) {
    const { fpHash } = globalStore.getState();
    const url = getModDownloadUrl({ itemId });
    const headers = buildModSseHeaders({ fpHash, token, sig });

    return startStreamingDownload({
        url,
        headers,
        abortSignal: signal || new AbortController().signal,
    });
}

async function prepareDownload(
    itemId: string,
    modName: string | undefined,
    itemName: string,
    token?: string,
    sig?: string,
    isDesktop?: boolean,
) {
    const store = modStore.getState();
    store.setStatus("collecting");

    const metadata = await getDownloadUrls({ itemId, token, sig });
    const { directoryName, rootHandle, suggestedName } = await prepareOpfsDownloadDirectory({
        itemId,
        itemName,
        rootName: modName,
        kind: "mod",
    });

    if (isDesktop) {
        store.clear();
    }

    return {
        metadata,
        directoryName,
        modRootHandle: rootHandle,
        suggestedName,
    };
}

interface StartDownloadForDesktopProps {
    mod?: AkashaModData | null;
    items: Content[];
    suggestedName?: string;
    token?: string;
    sig?: string;
}

export async function startDownloadForDesktop(props: StartDownloadForDesktopProps) {
    const { mod, items, suggestedName } = props;

    if (!items[0].size) {
        return;
    }

    const prepPromise = prepareDownload(
        items[0].id,
        mod?.mod.title,
        items[0].name,
        props.token,
        props.sig,
        true,
    );

    toast.promise(prepPromise, {
        loading: t("drive.#.processNextDownloadInQueue.toast-promise.loading"),
        error: (err: any) =>
            `${t("drive.#.processNextDownloadInQueue.toast-promise.error", { values: { error: err.message } })}`,
    });
    const prep = await prepPromise;

    await startDesktopDownload({
        type: "live",
        id: mod?.mod.id.toString() || "",
        data: prep.metadata,
        suggestedName: suggestedName || mod?.mod.title,
        minVersion: "1.14.0",
    });
}

interface StartDownloadProps {
    mod?: AkashaModData | null;
    items: Content[];
    abortSignal?: AbortSignal;
    token?: string;
    sig?: string;
}

export async function startDownload(props: StartDownloadProps) {
    let { mod, items } = props;

    if (items.length === 0) {
        throw new Error("아이템이 선택되지 않음");
    } else if (items.length > 1) {
        throw new Error("2개 이상 지원 안함");
    } else if (items[0].size && items[0].size > 100 * 1024 * 1024 * 1024) {
        toast.warning(t("toast.browser_download_too_large.title"), {
            description: t("toast.browser_download_too_large.description"),
        });
        return;
    }

    const abortController = new AbortController();
    const abortSignal = props.abortSignal || abortController.signal;

    try {
        await ensureBrowserOpfsDownloadSupport();
    } catch (error: unknown) {
        toast.warning(error instanceof Error ? error.message : String(error));
        return;
    }

    const store = modStore.getState();
    store.clear();

    let speedInterval: NodeJS.Timeout | null = null;
    let directoryName: string | null = null;

    try {
        const prep = await prepareDownload(
            items[0].id,
            mod?.mod.title,
            items[0].name,
            props.token,
            props.sig,
        );
        directoryName = prep.directoryName;
        const { modRootHandle } = prep;
        const { mtd, files, dirs, root, totalBytes } = prep.metadata;

        const dirHandles = await createOpfsDirectories(dirs, root, modRootHandle);

        const mtdContent = mtd
            ? `${mtd.type}:${mtd.modId}:${mtd.contentId}:${mtd.timestamp}:${mtd.key}:${mtd.forbiddenKnowledge}`
            : null;
        if (mtdContent) {
            await writeNahidaMetadataFile({
                files,
                dirHandles,
                rootHandle: modRootHandle,
                content: mtdContent,
            });
        }

        store.setStatus("transmitting");
        store.setTotalItems(files.length);
        store.setTotalBytes(totalBytes);

        let downloadedBytes = 0;
        let downloadedCount = 0;
        let speedBytesThisSecond = 0;

        const throttledUpdateProgress = throttle((percent: number) => {
            store.setProgress(percent);
        }, 100);

        const progress = {
            updateDownloadedBytes: (bytes: number) => {
                downloadedBytes += bytes;
                throttledUpdateProgress(Math.min((downloadedBytes / totalBytes) * 100, 100));
            },
            updateSpeed: (bytes: number) => {
                speedBytesThisSecond += bytes;
            },
        };

        speedInterval = setInterval(() => {
            store.setSentBytes(downloadedBytes);
            store.setSpeed(speedBytesThisSecond);
            speedBytesThisSecond = 0;
        }, 1000);

        const results = await downloadFilesToOpfs({
            files,
            dirHandles,
            rootHandle: modRootHandle,
            abortSignal,
            progress: {
                ...progress,
                fileCompleted: () => {
                    downloadedCount++;
                    store.setSentItems(downloadedCount);
                },
            },
            useProxyFallback: true,
        });

        const failedCount = results.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
            results.forEach((r) => {
                if (r.status === "rejected") console.error("File download failed:", r.reason);
            });
            await removeOpfsDirectory(directoryName);
            throw new Error(`${failedCount}개 파일 다운로드 실패`);
        }

        triggerStreamingZipDownload({
            directoryName,
            fileName: prep.suggestedName,
        });
    } catch (err: unknown) {
        console.error("startDownload Error:", err);
        if (directoryName) {
            try {
                await removeOpfsDirectory(directoryName);
            } catch (cleanupError) {
                console.warn(
                    "Failed to clean OPFS directory after mod download failure:",
                    cleanupError,
                );
            }
        }
        if (!(err instanceof Error && err.name === "AbortError")) {
            toast.error(i18n.t("g.download_failed"), {
                description: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    } finally {
        if (speedInterval) clearInterval(speedInterval);
        store.clear();
    }
}
