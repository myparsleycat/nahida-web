import * as fzstd from "fzstd";
import ky from "ky";
import type { KyResponse, Options } from "ky";

import { PROXY_URL } from "@/lib/const";

import { ByteSemaphore, ConcurrencySemaphore } from "./network";

const MAX_IN_FLIGHT_BYTES = 100 * 1024 * 1024;
const MAX_CONCURRENCY = 60;

export type OpfsFileInfo = {
    id: string;
    fileId: string;
    parentId: string | null;
    name: string;
    size: number;
    compAlg: "gzip" | "zstd" | null;
    url: string;
};

export type OpfsDirInfo = {
    id: string;
    parentId: string | null;
    name: string;
};

export async function ensureBrowserOpfsDownloadSupport() {
    if (!("storage" in navigator && "getDirectory" in navigator.storage)) {
        throw new Error("OPFS가 지원되지 않는 브라우저입니다");
    }

    if (!navigator.serviceWorker.controller) {
        throw new Error(
            "다운로드 서비스가 아직 준비되지 않았습니다. 새로고침 후 다시 시도해주세요",
        );
    }
}

export async function prepareOpfsDownloadDirectory(params: {
    itemId: string;
    itemName: string;
    rootName?: string;
    kind: "mod" | "drive" | "link";
}) {
    const { itemId, itemName, rootName, kind } = params;
    const opfsRoot = await navigator.storage.getDirectory();

    const suggestedBaseName = itemName === "root" ? rootName || itemName : itemName;
    const timestamp = Date.now();
    const directoryName = `akasha-${kind}-${itemId}_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;
    const rootHandle = await opfsRoot.getDirectoryHandle(directoryName, { create: true });

    return {
        directoryName,
        rootHandle,
        suggestedName: `${suggestedBaseName}.zip`,
    };
}

export async function removeOpfsDirectory(directoryName: string) {
    if (!navigator.storage?.getDirectory) {
        return;
    }

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.removeEntry(directoryName, { recursive: true });
    } catch (error: unknown) {
        if (!(error instanceof Error && error.name === "NotFoundError")) {
            throw error;
        }
    }
}

export async function createOpfsDirectories(
    dirs: OpfsDirInfo[],
    root: OpfsDirInfo,
    rootHandle: FileSystemDirectoryHandle,
) {
    const dirHandles: Record<string, FileSystemDirectoryHandle> = { [root.id]: rootHandle };

    for (const dir of dirs) {
        if (dir.id === root.id) continue;

        const parentHandle = dir.parentId ? dirHandles[dir.parentId] : rootHandle;
        if (!parentHandle) {
            throw new Error(`Cannot find parent directory for ${dir.name}`);
        }

        try {
            dirHandles[dir.id] = await parentHandle.getDirectoryHandle(dir.name, { create: true });
        } catch {
            dirHandles[dir.id] = await parentHandle.getDirectoryHandle(dir.name);
        }
    }

    return dirHandles;
}

export async function writeNahidaMetadataFile(params: {
    files: OpfsFileInfo[];
    dirHandles: Record<string, FileSystemDirectoryHandle>;
    rootHandle: FileSystemDirectoryHandle;
    content: string;
}) {
    const { files, dirHandles, rootHandle, content } = params;
    const iniFiles = files
        .filter(
            (file) =>
                file.name.toLowerCase().endsWith(".ini") &&
                !file.name.toLowerCase().startsWith("disabled"),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const targetDirHandle =
        iniFiles.length > 0 && iniFiles[0].parentId ? dirHandles[iniFiles[0].parentId] : rootHandle;

    const metadataFileHandle = await targetDirHandle.getFileHandle(".nahidamd", { create: true });
    const metadataWritable = await metadataFileHandle.createWritable();
    await metadataWritable.write(content);
    await metadataWritable.close();
}

export async function downloadFilesToOpfs(params: {
    files: OpfsFileInfo[];
    dirHandles: Record<string, FileSystemDirectoryHandle>;
    rootHandle: FileSystemDirectoryHandle;
    abortSignal: AbortSignal;
    progress: {
        updateDownloadedBytes: (bytes: number) => void;
        updateSpeed: (bytes: number) => void;
        fileCompleted?: () => void;
    };
    requestHeaders?: HeadersInit;
    useProxyFallback?: boolean;
}) {
    const {
        files,
        dirHandles,
        rootHandle,
        abortSignal,
        progress,
        requestHeaders,
        useProxyFallback = false,
    } = params;

    const semaphores = {
        byte: new ByteSemaphore(MAX_IN_FLIGHT_BYTES),
        concurrency: new ConcurrencySemaphore(MAX_CONCURRENCY),
    };

    const downloadPromises = files.map((file) =>
        downloadFile({
            file,
            dirHandles,
            rootHandle,
            abortSignal,
            semaphores,
            progress,
            requestHeaders,
            useProxyFallback,
        }),
    );

    return Promise.allSettled(downloadPromises);
}

export function triggerStreamingZipDownload(params: {
    directoryName: string;
    fileName: string;
    cleanupAfterDownload?: boolean;
}) {
    const { directoryName, fileName, cleanupAfterDownload = true } = params;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/sw-dl";
    form.style.display = "none";

    const fields = [
        ["directoryName", directoryName],
        ["fileName", fileName],
        ["cleanupAfterDownload", cleanupAfterDownload ? "1" : "0"],
    ] as const;

    for (const [name, value] of fields) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

async function downloadFile(params: {
    file: OpfsFileInfo;
    dirHandles: Record<string, FileSystemDirectoryHandle>;
    rootHandle: FileSystemDirectoryHandle;
    abortSignal: AbortSignal;
    semaphores: { byte: ByteSemaphore; concurrency: ConcurrencySemaphore };
    progress: {
        updateDownloadedBytes: (bytes: number) => void;
        updateSpeed: (bytes: number) => void;
        fileCompleted?: () => void;
    };
    requestHeaders?: HeadersInit;
    useProxyFallback: boolean;
}) {
    const {
        file,
        dirHandles,
        rootHandle,
        abortSignal,
        semaphores,
        progress,
        requestHeaders,
        useProxyFallback,
    } = params;
    const { url, compAlg, parentId, name: fileName, size: fileSize } = file;
    const parentDirHandle = parentId ? dirHandles[parentId] : rootHandle;

    if (!parentDirHandle) {
        throw new Error(`Cannot find parent directory for ${fileName}`);
    }

    try {
        const existingFileHandle = await parentDirHandle.getFileHandle(fileName);
        const existingFile = await existingFileHandle.getFile();
        if (existingFile.size === fileSize) {
            progress.updateDownloadedBytes(fileSize);
            progress.fileCompleted?.();
            return;
        }
    } catch {}

    await semaphores.concurrency.acquire();
    try {
        if (!url) throw new Error(`File URL is missing: ${fileName}`);

        const fileHandle = await parentDirHandle.getFileHandle(fileName, { create: true });
        const opfsWritable = await fileHandle.createWritable();

        const progressStream = new TransformStream({
            transform(chunk, controller) {
                progress.updateDownloadedBytes(chunk.byteLength);
                progress.updateSpeed(chunk.byteLength);
                controller.enqueue(chunk);
            },
        });

        await semaphores.byte.acquire(fileSize);
        try {
            let resp: KyResponse;
            const fetchOptions: Options = {
                signal: abortSignal,
                cache: "no-store",
                throwHttpErrors: false,
                headers: requestHeaders,
            };

            try {
                resp = await ky.get(url, fetchOptions);
            } catch (error) {
                if (!useProxyFallback) {
                    throw error;
                }

                console.warn("Retrying with proxy...", error);
                const proxyUrl = PROXY_URL + encodeURIComponent(url);
                resp = await ky.get(proxyUrl, fetchOptions);
            }

            const bodyStream = resp.body;
            if (!bodyStream) throw new Error("Failed to read response body stream");

            let finalStream = bodyStream.pipeThrough(progressStream);
            if (compAlg === "gzip") {
                finalStream = finalStream.pipeThrough(new DecompressionStream("gzip"));
            } else if (compAlg === "zstd") {
                let decompressor: fzstd.Decompress;
                const zstdStream = new TransformStream({
                    start(controller) {
                        decompressor = new fzstd.Decompress((chunk: Uint8Array) => {
                            controller.enqueue(chunk);
                        });
                    },
                    transform(chunk) {
                        decompressor.push(chunk);
                    },
                    flush() {
                        decompressor.push(new Uint8Array(0), true);
                    },
                });
                finalStream = finalStream.pipeThrough(zstdStream);
            }

            await finalStream.pipeTo(opfsWritable);
            progress.fileCompleted?.();
        } finally {
            semaphores.byte.release(fileSize);
        }
    } finally {
        semaphores.concurrency.release();
    }
}
