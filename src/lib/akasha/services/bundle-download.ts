import { Inflate } from "fflate";
import { createSHA256 } from "hash-wasm";

import { ByteSemaphore, ConcurrencySemaphore } from "./network";

const MAX_RANGE_BYTES = 25 * 1024 * 1024;
const MAX_RANGE_GAP_BYTES = 64 * 1024;
const MAX_IN_FLIGHT_BYTES = 100 * 1024 * 1024;
const MAX_CONCURRENCY = 6;
const MAX_RETRIES = 3;

export type OpfsBundleEntryInfo = {
    id: string;
    fileId: string;
    parentId: string | null;
    name: string;
    size: number;
    sha256: string;
    dataOffset: number;
    compressedSize: number;
    method: 0 | 8;
    crc32: number;
};

export type OpfsBundleInfo = {
    id: string;
    url: string;
    etag: string;
    archiveSize: number;
    entries: OpfsBundleEntryInfo[];
};

export function parseBundleChunk(value: unknown): OpfsBundleInfo[] {
    if (!Array.isArray(value)) throw new TypeError("Bundle SSE payload must be an array");
    return value.map((candidate, bundleIndex) => {
        const bundle = requireRecord(candidate, `bundles[${bundleIndex}]`);
        if (
            typeof bundle.id !== "string" ||
            typeof bundle.url !== "string" ||
            typeof bundle.etag !== "string" ||
            bundle.etag.length === 0 ||
            !isUnsignedInteger(bundle.archiveSize) ||
            !Array.isArray(bundle.entries)
        ) {
            throw new TypeError(`Invalid bundle SSE metadata at index ${bundleIndex}`);
        }
        return {
            id: bundle.id,
            url: bundle.url,
            etag: bundle.etag,
            archiveSize: bundle.archiveSize as number,
            entries: bundle.entries.map((candidateEntry, entryIndex) => {
                const entry = requireRecord(
                    candidateEntry,
                    `bundles[${bundleIndex}].entries[${entryIndex}]`,
                );
                if (
                    typeof entry.id !== "string" ||
                    typeof entry.fileId !== "string" ||
                    !(typeof entry.parentId === "string" || entry.parentId === null) ||
                    typeof entry.name !== "string" ||
                    typeof entry.sha256 !== "string" ||
                    !isUnsignedInteger(entry.size) ||
                    !isUnsignedInteger(entry.dataOffset) ||
                    !isUnsignedInteger(entry.compressedSize) ||
                    (entry.method !== 0 && entry.method !== 8) ||
                    !isUnsignedInteger(entry.crc32) ||
                    entry.crc32 > 0xffffffff
                ) {
                    throw new TypeError(
                        `Invalid bundle entry SSE metadata at ${bundleIndex}:${entryIndex}`,
                    );
                }
                return entry as OpfsBundleEntryInfo;
            }),
        };
    });
}

type DownloadProgress = {
    updateDownloadedBytes: (bytes: number) => void;
    updateSpeed: (bytes: number) => void;
    fileCompleted?: () => void;
};

type PlannedRange = {
    start: number;
    end: number;
    entries: OpfsBundleEntryInfo[];
};

export async function downloadBundlesToOpfs(params: {
    bundles: OpfsBundleInfo[];
    dirHandles: Record<string, FileSystemDirectoryHandle>;
    rootHandle: FileSystemDirectoryHandle;
    abortSignal: AbortSignal;
    progress: DownloadProgress;
}) {
    const semaphores = {
        byte: new ByteSemaphore(MAX_IN_FLIGHT_BYTES),
        concurrency: new ConcurrencySemaphore(MAX_CONCURRENCY),
    };

    const results = await Promise.allSettled(
        params.bundles.flatMap((bundle) => {
            const rangeCache = createRangeCache(bundle, params.abortSignal, params.progress);
            return bundle.entries.map((entry) =>
                downloadBundleEntry({
                    bundle,
                    entry,
                    dirHandles: params.dirHandles,
                    rootHandle: params.rootHandle,
                    abortSignal: params.abortSignal,
                    progress: params.progress,
                    semaphores,
                    rangeCache,
                }),
            );
        }),
    );

    return results;
}

function createRangeCache(
    bundle: OpfsBundleInfo,
    abortSignal: AbortSignal,
    progress: DownloadProgress,
) {
    const ranges = planBundleRanges(bundle.entries);
    const entryRanges = new Map(
        ranges.flatMap((range) => range.entries.map((entry) => [entry.id, range])),
    );
    const requests = new Map<PlannedRange, Promise<Uint8Array>>();
    const remaining = new Map(ranges.map((range) => [range, range.entries.length]));

    return {
        async read(entry: OpfsBundleEntryInfo) {
            const range = entryRanges.get(entry.id);
            if (!range) return null;

            const request =
                requests.get(range) ??
                fetchVerifiedRange({
                    bundle,
                    start: range.start,
                    end: range.end,
                    abortSignal,
                    progress,
                });
            requests.set(range, request);

            const data = await request;
            const entryStart = entry.dataOffset - range.start;
            const result = data.subarray(entryStart, entryStart + entry.compressedSize);
            const nextRemaining = (remaining.get(range) ?? 1) - 1;
            remaining.set(range, nextRemaining);
            if (nextRemaining === 0) {
                requests.delete(range);
                remaining.delete(range);
            }
            return result;
        },
    };
}

function planBundleRanges(entries: OpfsBundleEntryInfo[]) {
    return entries
        .filter((entry) => entry.compressedSize > 0 && entry.compressedSize <= MAX_RANGE_BYTES)
        .sort((a, b) => a.dataOffset - b.dataOffset)
        .reduce<PlannedRange[]>((ranges, entry) => {
            const end = entry.dataOffset + entry.compressedSize - 1;
            const previous = ranges.at(-1);
            if (
                previous &&
                entry.dataOffset - previous.end - 1 <= MAX_RANGE_GAP_BYTES &&
                end - previous.start + 1 <= MAX_RANGE_BYTES
            ) {
                previous.end = Math.max(previous.end, end);
                previous.entries.push(entry);
                return ranges;
            }
            ranges.push({ start: entry.dataOffset, end, entries: [entry] });
            return ranges;
        }, []);
}

async function downloadBundleEntry(params: {
    bundle: OpfsBundleInfo;
    entry: OpfsBundleEntryInfo;
    dirHandles: Record<string, FileSystemDirectoryHandle>;
    rootHandle: FileSystemDirectoryHandle;
    abortSignal: AbortSignal;
    progress: DownloadProgress;
    semaphores: { byte: ByteSemaphore; concurrency: ConcurrencySemaphore };
    rangeCache: ReturnType<typeof createRangeCache>;
}) {
    const parentHandle = params.entry.parentId
        ? params.dirHandles[params.entry.parentId]
        : params.rootHandle;
    if (!parentHandle) {
        throw new Error(`Cannot find parent directory for ${params.entry.name}`);
    }
    try {
        const existing = await (await parentHandle.getFileHandle(params.entry.name)).getFile();
        if (existing.size === params.entry.size) {
            params.progress.updateDownloadedBytes(params.entry.size);
            params.progress.fileCompleted?.();
            return;
        }
    } catch {}

    await params.semaphores.concurrency.acquire();
    await params.semaphores.byte.acquire(params.entry.size);
    try {
        params.abortSignal.throwIfAborted();
        const partName = `.akasha-part-${safeName(params.entry.fileId)}-${safeName(params.bundle.etag)}`;
        const partHandle = await parentHandle.getFileHandle(partName, { create: true });
        const resumableSize = params.entry.method === 0 ? (await partHandle.getFile()).size : 0;
        const resumeAt = resumableSize <= params.entry.size ? resumableSize : 0;
        if (params.entry.method === 8 || resumableSize > params.entry.size) {
            await truncateFile(partHandle);
        }

        const writable = await partHandle.createWritable({ keepExistingData: resumeAt > 0 });
        if (resumeAt > 0) await writable.seek(resumeAt);

        const hasher = await createSHA256();
        hasher.init();
        if (resumeAt > 0) {
            const reader = (await partHandle.getFile()).slice(0, resumeAt).stream().getReader();
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                hasher.update(chunk.value);
            }
            params.progress.updateDownloadedBytes(resumeAt);
        }

        let outputBytes = resumeAt;
        const write = async (chunk: Uint8Array) => {
            params.abortSignal.throwIfAborted();
            hasher.update(chunk);
            outputBytes += chunk.byteLength;
            params.progress.updateDownloadedBytes(chunk.byteLength);
            await writable.write(new Uint8Array(chunk));
        };

        try {
            if (params.entry.method === 0) {
                if (resumeAt < params.entry.size) {
                    const cached =
                        resumeAt === 0 ? await params.rangeCache.read(params.entry) : null;
                    if (cached) {
                        await write(cached);
                    } else {
                        for (const range of splitRange(
                            params.entry.dataOffset + resumeAt,
                            params.entry.dataOffset + params.entry.compressedSize - 1,
                        )) {
                            await write(
                                await fetchVerifiedRange({
                                    bundle: params.bundle,
                                    ...range,
                                    abortSignal: params.abortSignal,
                                    progress: params.progress,
                                }),
                            );
                        }
                    }
                }
            } else {
                const outputs: Uint8Array[] = [];
                const inflater = new Inflate((chunk) => outputs.push(chunk));
                const cached = await params.rangeCache.read(params.entry);
                if (cached) {
                    inflater.push(cached, true);
                    for (const output of outputs.splice(0)) await write(output);
                } else {
                    const ranges = splitRange(
                        params.entry.dataOffset,
                        params.entry.dataOffset + params.entry.compressedSize - 1,
                    );
                    for (const [index, range] of ranges.entries()) {
                        inflater.push(
                            await fetchVerifiedRange({
                                bundle: params.bundle,
                                ...range,
                                abortSignal: params.abortSignal,
                                progress: params.progress,
                            }),
                            index === ranges.length - 1,
                        );
                        for (const output of outputs.splice(0)) await write(output);
                    }
                }
            }

            await writable.close();
        } catch (error) {
            await writable.abort(error).catch(() => undefined);
            throw error;
        }

        if (outputBytes !== params.entry.size) {
            await parentHandle.removeEntry(partName).catch(() => undefined);
            throw new Error(
                `Bundle entry size mismatch for ${params.entry.name}: ${outputBytes}/${params.entry.size}`,
            );
        }
        const digest = hasher.digest("hex");
        if (digest !== params.entry.sha256.toLowerCase()) {
            await parentHandle.removeEntry(partName).catch(() => undefined);
            throw new Error(`Bundle entry SHA-256 mismatch for ${params.entry.name}`);
        }

        await commitPartFile(parentHandle, partHandle, partName, params.entry.name);
        params.progress.fileCompleted?.();
    } finally {
        params.semaphores.byte.release(params.entry.size);
        params.semaphores.concurrency.release();
    }
}

async function truncateFile(handle: FileSystemFileHandle) {
    const writable = await handle.createWritable();
    await writable.truncate(0);
    await writable.close();
}

async function commitPartFile(
    parentHandle: FileSystemDirectoryHandle,
    partHandle: FileSystemFileHandle,
    partName: string,
    fileName: string,
) {
    const movable = partHandle as FileSystemFileHandle & {
        move?: (name: string) => Promise<void>;
    };
    if (movable.move) {
        await parentHandle.removeEntry(fileName).catch(() => undefined);
        await movable.move(fileName);
        return;
    }

    const finalHandle = await parentHandle.getFileHandle(fileName, { create: true });
    await (await partHandle.getFile()).stream().pipeTo(await finalHandle.createWritable());
    await parentHandle.removeEntry(partName);
}

function splitRange(start: number, end: number) {
    const ranges: { start: number; end: number }[] = [];
    for (let offset = start; offset <= end; offset += MAX_RANGE_BYTES) {
        ranges.push({ start: offset, end: Math.min(offset + MAX_RANGE_BYTES - 1, end) });
    }
    return ranges;
}

async function fetchVerifiedRange(params: {
    bundle: OpfsBundleInfo;
    start: number;
    end: number;
    abortSignal: AbortSignal;
    progress: DownloadProgress;
}) {
    if (params.end - params.start + 1 > MAX_RANGE_BYTES) {
        throw new Error("Bundle range exceeds 25 MiB");
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        params.abortSignal.throwIfAborted();
        try {
            const response = await fetch(params.bundle.url, {
                headers: {
                    Range: `bytes=${params.start}-${params.end}`,
                    "If-Match": params.bundle.etag.startsWith('"')
                        ? params.bundle.etag
                        : `"${params.bundle.etag}"`,
                },
                cache: "no-store",
                signal: params.abortSignal,
            });
            const contentRange = response.headers.get("Content-Range");
            const expectedPrefix = `bytes ${params.start}-${params.end}/`;
            if (response.status !== 206 || !contentRange?.startsWith(expectedPrefix)) {
                throw new Error(
                    `Invalid bundle range response: ${response.status} ${contentRange ?? "missing Content-Range"}`,
                );
            }
            const data = new Uint8Array(await response.arrayBuffer());
            if (data.byteLength !== params.end - params.start + 1) {
                throw new Error(`Bundle range length mismatch: ${data.byteLength}`);
            }
            params.progress.updateSpeed(data.byteLength);
            return data;
        } catch (error) {
            if (attempt === MAX_RETRIES || params.abortSignal.aborted) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
        }
    }
    throw new Error("Bundle range retry limit exceeded");
}

function safeName(value: string) {
    return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function countBundleEntries(bundles: OpfsBundleInfo[]) {
    return bundles.reduce((sum, bundle) => sum + bundle.entries.length, 0);
}

function requireRecord(value: unknown, name: string) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object`);
    }
    return value as Record<string, unknown>;
}

function isUnsignedInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}
