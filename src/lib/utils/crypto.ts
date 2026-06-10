import { createSHA256 } from "hash-wasm";

import SHA256Worker from "@/lib/workers/sha256.workers?worker";

export const calculateFileSha256 = async (file: File): Promise<string | null> => {
    if (typeof window !== "undefined") {
        const CHUNK_SIZE = 100 * 1024 * 1024;
        const WORKER_COUNT = navigator.hardwareConcurrency || 4;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        const chunkHashes: string[] = new Array(totalChunks);
        const workers: Worker[] = [];
        let completedChunks = 0;
        let nextChunkIndex = 0;

        return new Promise((resolve, reject) => {
            const processNextChunk = async (worker: Worker) => {
                if (nextChunkIndex >= totalChunks) {
                    return;
                }

                const start = nextChunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                const chunkBuffer = await chunk.arrayBuffer();

                worker.postMessage(
                    {
                        chunk: chunkBuffer,
                        chunkIndex: nextChunkIndex,
                    },
                    [chunkBuffer],
                );

                nextChunkIndex++;
            };

            const createWorker = () => {
                const worker = new SHA256Worker();

                worker.onmessage = async (event) => {
                    const { success, hash, chunkIndex, error } = event.data;

                    if (!success) {
                        terminateAllWorkers();
                        reject(new Error(error));
                        return;
                    }

                    chunkHashes[chunkIndex] = hash;
                    completedChunks++;

                    if (completedChunks === totalChunks) {
                        try {
                            const finalHasher = await createSHA256();
                            finalHasher.init();

                            for (const chunkHash of chunkHashes) {
                                finalHasher.update(new TextEncoder().encode(chunkHash));
                            }

                            const finalHash = finalHasher.digest("hex");
                            terminateAllWorkers();
                            resolve(finalHash);
                        } catch (error) {
                            terminateAllWorkers();
                            reject(error);
                        }
                    } else {
                        processNextChunk(worker);
                    }
                };

                worker.onerror = (error) => {
                    terminateAllWorkers();
                    reject(new Error("Worker error: " + error.message));
                };

                return worker;
            };

            const terminateAllWorkers = () => {
                workers.forEach((worker) => worker.terminate());
            };

            for (let i = 0; i < Math.min(WORKER_COUNT, totalChunks); i++) {
                const worker = createWorker();
                workers.push(worker);
                processNextChunk(worker);
            }
        });
    } else return null;
};
