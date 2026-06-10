interface WorkerData {
    chunk: ArrayBuffer;
    chunkIndex: number;
}

async function calculateSHA256(buf: ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

self.onmessage = async (event: MessageEvent<WorkerData>) => {
    const { chunk, chunkIndex } = event.data;

    try {
        const hash = await calculateSHA256(chunk);

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
