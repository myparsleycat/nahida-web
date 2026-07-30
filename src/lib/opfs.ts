const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export async function cleanupOldOpfsDirectories() {
    if (!("storage" in navigator && "getDirectory" in navigator.storage)) {
        console.log("OPFS is not supported in this browser.");
        return;
    }

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const now = Date.now();

        for await (const entry of opfsRoot.values()) {
            if (entry.kind !== "directory") {
                continue;
            }

            const parts = entry.name.split("_");
            if (parts.length < 2) {
                continue;
            }

            const timestampStr =
                parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1];
            const timestamp = parseInt(timestampStr, 10);

            if (isNaN(timestamp)) {
                // Not a directory we should manage
                continue;
            }

            const age = now - timestamp;

            if (age > TWO_HOURS_MS) {
                try {
                    await opfsRoot.removeEntry(entry.name, { recursive: true });
                } catch (removeError) {
                    console.error(`Failed to remove directory ${entry.name}:`, removeError);
                }
            }
        }
    } catch (error) {
        console.error("Failed to run OPFS cleanup:", error);
    }
}

export async function cleanupUploadOpfsArtifacts() {
    if (!navigator.storage?.getDirectory) return;
    try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.removeEntry("akasha_uploads", { recursive: true });
    } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) {
            console.warn("Failed to remove legacy upload artifacts:", error);
        }
    }
}

export async function calculateOpfsSize() {
    if (!navigator.storage?.getDirectory) {
        console.warn("OPFS is not supported.");
        return 0;
    }

    const opfsRoot = await navigator.storage.getDirectory();
    let totalSize = 0;

    async function recurse(dirHandle: FileSystemDirectoryHandle) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === "file") {
                const file = await entry.getFile();
                totalSize += file.size;
            } else if (entry.kind === "directory") {
                await recurse(entry);
            }
        }
    }

    await recurse(opfsRoot);
    return totalSize;
}

export async function clearAllOpfsData() {
    if (!navigator.storage?.getDirectory) {
        console.warn("OPFS is not supported.");
        return;
    }

    const opfsRoot = await navigator.storage.getDirectory();
    const entries = [];

    for await (const entry of opfsRoot.values()) {
        entries.push(entry.name);
    }

    for (const name of entries) {
        try {
            await opfsRoot.removeEntry(name, { recursive: true });
        } catch (e) {
            console.error(`Failed to remove entry ${name}:`, e);
        }
    }
}
