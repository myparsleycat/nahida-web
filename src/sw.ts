/// <reference lib="webworker" />

import { downloadZip } from "client-zip";

declare var self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
    void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

async function* getFilesFromOpfs(
    dirHandle: FileSystemDirectoryHandle,
    currentPath = "",
): AsyncGenerator<{ name: string; input: File }> {
    for await (const entry of dirHandle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (entry.kind === "file") {
            const file = await entry.getFile();
            yield { name: entryPath, input: file };
        } else if (entry.kind === "directory") {
            yield* getFilesFromOpfs(entry, entryPath);
        }
    }
}

async function cleanupDirectory(directoryName: string) {
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.removeEntry(directoryName, { recursive: true });
    } catch (error) {
        if (error instanceof Error && error.name !== "NotFoundError") {
            console.warn("Failed to cleanup OPFS directory:", directoryName, error);
        }
    }
}

async function handleDownloadRequest(request: Request) {
    let directoryName: string | null = null;
    try {
        const formData = await request.formData();
        directoryName = formData.get("directoryName") as string | null;
        const fileName = formData.get("fileName") as string | null;
        const cleanupAfterDownload = formData.get("cleanupAfterDownload") === "1";

        if (!directoryName || !fileName) {
            return new Response("Missing directoryName or fileName in form data.", { status: 400 });
        }

        const opfsRoot = await navigator.storage.getDirectory();
        let modRootHandle: FileSystemDirectoryHandle;

        try {
            modRootHandle = await opfsRoot.getDirectoryHandle(directoryName);
        } catch (error) {
            if (error instanceof DOMException && error.name === "NotFoundError") {
                return new Response(`Directory '${directoryName}' not found.`, { status: 404 });
            }
            throw error;
        }

        const filesIterable = getFilesFromOpfs(modRootHandle);

        const zipStreamResponse = downloadZip(filesIterable);
        const sourceStream = zipStreamResponse.body;

        const encodedFileName = encodeURIComponent(fileName).replace(/'/g, "%27");
        const headers = {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodedFileName}`,
        };

        if (!sourceStream || !cleanupAfterDownload) {
            return new Response(sourceStream, { headers });
        }

        const reader = sourceStream.getReader();
        let cleaned = false;
        const cleanupOnce = async () => {
            if (cleaned) return;
            cleaned = true;
            await cleanupDirectory(directoryName!);
        };

        const wrappedStream = new ReadableStream({
            async pull(controller) {
                try {
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        await cleanupOnce();
                        return;
                    }

                    controller.enqueue(value);
                } catch (error) {
                    controller.error(error);
                    await cleanupOnce();
                }
            },
            async cancel(reason) {
                try {
                    await reader.cancel(reason);
                } finally {
                    await cleanupOnce();
                }
            },
        });

        return new Response(wrappedStream, { headers });
    } catch (error) {
        console.error("Service Worker download error:", error);
        if (directoryName) {
            await cleanupDirectory(directoryName);
        }
        return new Response(String(error), { status: 500 });
    }
}

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    if (
        url.origin === self.origin &&
        url.pathname === "/sw-dl" &&
        event.request.method === "POST"
    ) {
        event.respondWith(handleDownloadRequest(event.request));
    }
});
