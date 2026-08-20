import { createSHA256 } from "hash-wasm";

const HASH_SLICE_SIZE = 4 * 1024 * 1024;

interface HashWorkerRequest {
    files: Array<{ FID: string; file: File }>;
}

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
    const hashes: Array<[string, string]> = [];

    try {
        for (const [fileIndex, entry] of event.data.files.entries()) {
            const hasher = await createSHA256();
            hasher.init();
            for (let offset = 0; offset < entry.file.size; offset += HASH_SLICE_SIZE) {
                hasher.update(
                    new Uint8Array(
                        await entry.file
                            .slice(offset, Math.min(offset + HASH_SLICE_SIZE, entry.file.size))
                            .arrayBuffer(),
                    ),
                );
            }
            hashes.push([entry.FID, hasher.digest("hex")]);
            self.postMessage({ type: "progress", fileIndex });
        }

        self.postMessage({ type: "complete", hashes });
    } catch (error) {
        self.postMessage({
            type: "error",
            error: error instanceof Error ? error.message : "hash_failed",
        });
    }
};
