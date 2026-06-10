import { createMD5 } from "hash-wasm";

interface ChunkHashWorkerData {
    chunk: Blob;
    chunkIndex: number;
}

self.onmessage = async (event: MessageEvent<ChunkHashWorkerData>) => {
    const { chunk, chunkIndex } = event.data;

    try {
        const chunkBuffer = await chunk.arrayBuffer();
        const hasher = await createMD5();
        hasher.init();
        hasher.update(new Uint8Array(chunkBuffer));
        const hash = hasher.digest("hex");

        self.postMessage({
            success: true,
            hash,
            chunkIndex,
        });
    } catch (error: any) {
        self.postMessage({
            success: false,
            error: error.message,
            chunkIndex,
        });
    }
};
