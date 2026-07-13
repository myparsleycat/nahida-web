import { decode } from "cbor-x";
import ky from "ky";

import { decompressData } from "./drive-common";

const processStreamedData = async (jsonString: string) => {
    const payload: {
        type: "cbor" | "string";
        compressed: boolean;
        data: string;
    } = JSON.parse(jsonString);

    if (payload.compressed) {
        const decompressed = await decompressData(payload.data);
        if (payload.type === "cbor") {
            return decode(decompressed);
        }
        const decoder = new TextDecoder();
        return decoder.decode(decompressed);
    }

    return JSON.parse(payload.data);
};

let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

self.onmessage = async (event) => {
    const { url, token, fpHash, storageVersion, type: msgType } = event.data;

    if (msgType === "abort") {
        if (activeReader) {
            try {
                activeReader.cancel();
            } catch {}
            activeReader = null;
        }
        self.postMessage({ type: "error", payload: "Download aborted" });
        return;
    }

    try {
        const resp = await ky.get(url, {
            headers: {
                Accept: "text/event-stream",
                ...(fpHash && { "X-FPH": fpHash }),
                ...(token && { "nhd-link-token": token }),
                ...(storageVersion && { "x-akasha-storage-version": storageVersion }),
            },
            credentials: "include",
        });

        const reader = resp.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get ReadableStream reader.");
        }

        activeReader = reader;

        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split("\n\n");

            buffer = parts.pop() || "";

            for (const part of parts) {
                let eventType = "message";
                let eventData = "";

                const lines = part.split("\n");
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        eventType = line.substring(7).trim();
                    } else if (line.startsWith("data: ")) {
                        eventData = line.substring(6).trim();
                    }
                }

                if (eventData) {
                    try {
                        switch (eventType) {
                            case "dirs": {
                                const dirsChunk = await processStreamedData(eventData);
                                self.postMessage({ type: "dirs", payload: dirsChunk });
                                break;
                            }
                            case "files": {
                                const filesChunk = await processStreamedData(eventData);
                                self.postMessage({ type: "files", payload: filesChunk });
                                break;
                            }
                            case "bundles": {
                                const bundlesChunk = await processStreamedData(eventData);
                                self.postMessage({ type: "bundles", payload: bundlesChunk });
                                break;
                            }
                            case "metadata": {
                                const metadata = JSON.parse(eventData);
                                self.postMessage({ type: "metadata", payload: metadata });
                                break;
                            }
                            case "complete": {
                                self.postMessage({ type: "complete" });
                                reader.cancel();
                                activeReader = null;
                                return;
                            }
                            case "error": {
                                const data = JSON.parse(eventData);
                                self.postMessage({
                                    type: "error",
                                    payload: data.message || "An unknown server error occurred",
                                });
                                reader.cancel();
                                activeReader = null;
                                return;
                            }
                        }
                    } catch (err) {
                        self.postMessage({
                            type: "error",
                            payload: `Failed to process ${eventType} data`,
                        });
                        reader.cancel();
                        activeReader = null;
                        return;
                    }
                }
            }
        }
    } catch (err) {
        activeReader = null;
        if (err instanceof Error && err.name !== "AbortError") {
            self.postMessage({ type: "error", payload: "SSE connection error: " + err.message });
        }
    }
};
