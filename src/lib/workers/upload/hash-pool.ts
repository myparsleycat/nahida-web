import sha256worker from "@/lib/workers/akasha.sha256.worker?worker";

export const createSha256WorkerPool = (size: number): Worker[] => {
    const workers: Worker[] = [];
    for (let i = 0; i < size; i++) {
        const worker = new sha256worker();
        workers.push(worker);
    }
    return workers;
};

export const cleanupSha256Workers = (workers: Worker[]) => {
    workers.forEach((worker) => {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
    });
};

interface HashableFile {
    FID: string;
    file: File;
}

export async function calculateHashesInParallel(
    files: HashableFile[],
    onProgress?: (completed: number, total: number) => void,
): Promise<Map<string, string>> {
    const maxAvailableCores = navigator.hardwareConcurrency || 4;
    const optimalWorkerCount = Math.min(files.length, maxAvailableCores);

    const workers = createSha256WorkerPool(optimalWorkerCount);
    let completedFiles = 0;

    const chunks: HashableFile[][] = Array.from({ length: optimalWorkerCount }, () => []);
    files.forEach((file, index) => {
        const workerIndex = index % optimalWorkerCount;
        chunks[workerIndex].push(file);
    });

    try {
        const results = await Promise.all(
            chunks.map((chunk, workerIndex) => {
                return new Promise<Map<string, string>>((resolve, reject) => {
                    const worker = workers[workerIndex];

                    worker.onmessage = (e) => {
                        if (e.data.type === "progress") {
                            completedFiles++;
                            onProgress?.(completedFiles, files.length);
                        } else if (e.data.type === "complete") {
                            resolve(new Map(e.data.hashes));
                        } else if (e.data.type === "error") {
                            reject(e.data.error);
                        }
                    };

                    worker.onerror = (error) => {
                        reject(error);
                    };

                    worker.postMessage({ files: chunk });
                });
            }),
        );

        const combinedHashes = new Map<string, string>();
        results.forEach((result) => {
            result.forEach((hash, fid) => {
                combinedHashes.set(fid, hash);
            });
        });

        return combinedHashes;
    } finally {
        cleanupSha256Workers(workers);
    }
}
