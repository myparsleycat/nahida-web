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
            let settled = false;

            const terminateAllWorkers = () => {
                workers.forEach((worker) => worker.terminate());
            };

            const fail = (error: unknown) => {
                if (settled) return;
                settled = true;
                terminateAllWorkers();
                reject(error);
            };

            const succeed = (hash: string) => {
                if (settled) return;
                settled = true;
                terminateAllWorkers();
                resolve(hash);
            };

            const processNextChunk = async (worker: Worker) => {
                if (settled || nextChunkIndex >= totalChunks) {
                    return;
                }

                const start = nextChunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                const chunkBuffer = await chunk.arrayBuffer();

                if (settled) return;

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
                    if (settled) return;

                    try {
                        const { success, hash, chunkIndex, error } = event.data;

                        if (!success) {
                            fail(new Error(error));
                            return;
                        }

                        chunkHashes[chunkIndex] = hash;
                        completedChunks++;

                        if (completedChunks === totalChunks) {
                            const finalHasher = await createSHA256();
                            finalHasher.init();

                            for (const chunkHash of chunkHashes) {
                                finalHasher.update(new TextEncoder().encode(chunkHash));
                            }

                            const finalHash = finalHasher.digest("hex");
                            succeed(finalHash);
                            return;
                        }
                    } catch (error) {
                        fail(error);
                    }

                    void processNextChunk(worker).catch(fail);
                };

                worker.onerror = (error) => {
                    fail(new Error("Worker error: " + error.message));
                };

                return worker;
            };

            for (let i = 0; i < Math.min(WORKER_COUNT, totalChunks); i++) {
                try {
                    const worker = createWorker();
                    workers.push(worker);
                    void processNextChunk(worker).catch(fail);
                } catch (error) {
                    fail(error);
                    return;
                }
            }
        });
    } else return null;
};
