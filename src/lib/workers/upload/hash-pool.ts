import Sha256Worker from "@/lib/workers/akasha.sha256.worker?worker";

const MAX_HASH_WORKERS = 2;

interface HashableFile {
    FID: string;
    file: File;
}

type HashWorkerMessage =
    | { type: "progress"; fileIndex: number }
    | { type: "complete"; hashes: Array<[string, string]> }
    | { type: "error"; error: string };

export function createSha256WorkerPool(size: number) {
    return Array.from({ length: Math.min(size, MAX_HASH_WORKERS) }, () => new Sha256Worker());
}

export function cleanupSha256Workers(workers: Worker[]) {
    workers.forEach((worker) => {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
    });
}

export async function calculateHashesInParallel(
    files: HashableFile[],
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal,
) {
    if (files.length === 0) return new Map<string, string>();
    signal?.throwIfAborted();
    const workers = createSha256WorkerPool(
        Math.min(files.length, navigator.hardwareConcurrency || MAX_HASH_WORKERS),
    );
    const chunks = Array.from({ length: workers.length }, () => [] as HashableFile[]);
    files.forEach((file, index) => chunks[index % workers.length].push(file));
    let completedFiles = 0;
    const abortListenerCleanups = new Set<() => void>();

    try {
        const results = await Promise.all(
            chunks.map(
                (workerFiles, workerIndex) =>
                    new Promise<Map<string, string>>((resolve, reject) => {
                        const worker = workers[workerIndex];
                        const abort = () => reject(new DOMException("Aborted", "AbortError"));
                        const removeAbortListener = () => {
                            signal?.removeEventListener("abort", abort);
                            abortListenerCleanups.delete(removeAbortListener);
                        };
                        signal?.addEventListener("abort", abort, { once: true });
                        abortListenerCleanups.add(removeAbortListener);
                        const finish = <T>(callback: (value: T) => void, value: T) => {
                            removeAbortListener();
                            callback(value);
                        };

                        worker.onmessage = (event: MessageEvent<HashWorkerMessage>) => {
                            if (event.data.type === "progress") {
                                completedFiles++;
                                onProgress?.(completedFiles, files.length);
                                return;
                            }
                            if (event.data.type === "complete") {
                                finish(resolve, new Map(event.data.hashes));
                                return;
                            }
                            finish(reject, new Error(event.data.error));
                        };
                        worker.onerror = (error) => finish(reject, error);
                        worker.postMessage({ files: workerFiles });
                    }),
            ),
        );
        return new Map(results.flatMap((result) => [...result]));
    } finally {
        [...abortListenerCleanups].forEach((cleanup) => cleanup());
        cleanupSha256Workers(workers);
    }
}
