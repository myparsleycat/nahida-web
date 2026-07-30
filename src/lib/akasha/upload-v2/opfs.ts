const UPLOAD_ROOT_NAME = "akasha_uploads";
const SOURCE_DIRECTORY_NAME = "source";
const ENCODED_DIRECTORY_NAME = "encoded";

export interface UploadStorageAvailability {
    persisted: boolean;
    quota: number;
    usage: number;
    available: number;
}

export function supportsUploadOpfs() {
    return (
        typeof navigator !== "undefined" &&
        "storage" in navigator &&
        typeof navigator.storage.getDirectory === "function"
    );
}

export async function ensureUploadStorage(requiredBytes = 0): Promise<UploadStorageAvailability> {
    if (!supportsUploadOpfs()) {
        throw new Error("storage_unavailable");
    }

    const persisted = (await navigator.storage.persist?.()) ?? false;
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    const available = Math.max(0, quota - usage);

    if (available < requiredBytes) {
        throw new Error("storage_quota_exceeded");
    }

    await getUploadRoot(true);
    return { persisted, quota, usage, available };
}

export async function writeSourceArtifact(requestId: string, clientId: string, source: Blob) {
    return writeArtifact(requestId, SOURCE_DIRECTORY_NAME, clientId, source);
}

export async function readSourceArtifact(requestId: string, clientId: string) {
    return readArtifact(requestId, SOURCE_DIRECTORY_NAME, clientId);
}

export async function hasSourceArtifact(requestId: string, clientId: string) {
    return hasArtifact(requestId, SOURCE_DIRECTORY_NAME, clientId);
}

export async function deleteSourceArtifact(requestId: string, clientId: string) {
    await deleteArtifact(requestId, SOURCE_DIRECTORY_NAME, clientId);
}

export async function writeEncodedArtifact(requestId: string, intentId: string, source: Blob) {
    return writeArtifact(requestId, ENCODED_DIRECTORY_NAME, intentId, source);
}

export async function readEncodedArtifact(requestId: string, intentId: string) {
    return readArtifact(requestId, ENCODED_DIRECTORY_NAME, intentId);
}

export async function hasEncodedArtifact(requestId: string, intentId: string) {
    return hasArtifact(requestId, ENCODED_DIRECTORY_NAME, intentId);
}

export async function deleteEncodedArtifact(requestId: string, intentId: string) {
    await deleteArtifact(requestId, ENCODED_DIRECTORY_NAME, intentId);
}

export async function deleteUploadSessionArtifacts(requestId: string) {
    assertPathSegment(requestId);
    const uploadRoot = await getUploadRoot(false);
    if (!uploadRoot) return;

    try {
        await uploadRoot.removeEntry(requestId, { recursive: true });
    } catch (error: unknown) {
        if (!isNotFoundError(error)) throw error;
    }
}

export function getSourceArtifactPath(requestId: string, clientId: string) {
    assertPathSegment(requestId);
    assertPathSegment(clientId);
    return `${UPLOAD_ROOT_NAME}/${requestId}/${SOURCE_DIRECTORY_NAME}/${clientId}`;
}

export function getEncodedArtifactPath(requestId: string, intentId: string) {
    assertPathSegment(requestId);
    assertPathSegment(intentId);
    return `${UPLOAD_ROOT_NAME}/${requestId}/${ENCODED_DIRECTORY_NAME}/${intentId}`;
}

async function writeArtifact(
    requestId: string,
    directoryName: typeof SOURCE_DIRECTORY_NAME | typeof ENCODED_DIRECTORY_NAME,
    artifactId: string,
    source: Blob,
) {
    const directory = await getArtifactDirectory(requestId, directoryName, true);
    if (!directory) throw new Error("storage_unavailable");
    assertPathSegment(artifactId);
    const handle = await directory.getFileHandle(artifactId, { create: true });
    const writable = await handle.createWritable();

    try {
        await source.stream().pipeTo(writable);
    } catch (error: unknown) {
        await writable.abort(error).catch(() => undefined);
        await directory.removeEntry(artifactId).catch(() => undefined);
        throw error;
    }

    return handle.getFile();
}

async function readArtifact(
    requestId: string,
    directoryName: typeof SOURCE_DIRECTORY_NAME | typeof ENCODED_DIRECTORY_NAME,
    artifactId: string,
) {
    const directory = await getArtifactDirectory(requestId, directoryName, false);
    if (!directory) return undefined;
    assertPathSegment(artifactId);

    try {
        return await (await directory.getFileHandle(artifactId)).getFile();
    } catch (error: unknown) {
        if (isNotFoundError(error)) return undefined;
        throw error;
    }
}

async function hasArtifact(
    requestId: string,
    directoryName: typeof SOURCE_DIRECTORY_NAME | typeof ENCODED_DIRECTORY_NAME,
    artifactId: string,
) {
    return Boolean(await readArtifact(requestId, directoryName, artifactId));
}

async function deleteArtifact(
    requestId: string,
    directoryName: typeof SOURCE_DIRECTORY_NAME | typeof ENCODED_DIRECTORY_NAME,
    artifactId: string,
) {
    const directory = await getArtifactDirectory(requestId, directoryName, false);
    if (!directory) return;
    assertPathSegment(artifactId);

    try {
        await directory.removeEntry(artifactId);
    } catch (error: unknown) {
        if (!isNotFoundError(error)) throw error;
    }
}

async function getArtifactDirectory(
    requestId: string,
    directoryName: typeof SOURCE_DIRECTORY_NAME | typeof ENCODED_DIRECTORY_NAME,
    create: boolean,
) {
    assertPathSegment(requestId);
    const uploadRoot = await getUploadRoot(create);
    if (!uploadRoot) return undefined;

    try {
        const session = await uploadRoot.getDirectoryHandle(requestId, { create });
        return await session.getDirectoryHandle(directoryName, { create });
    } catch (error: unknown) {
        if (!create && isNotFoundError(error)) return undefined;
        throw error;
    }
}

async function getUploadRoot(create: boolean) {
    if (!supportsUploadOpfs()) {
        if (!create) return undefined;
        throw new Error("storage_unavailable");
    }

    const root = await navigator.storage.getDirectory();
    try {
        return await root.getDirectoryHandle(UPLOAD_ROOT_NAME, { create });
    } catch (error: unknown) {
        if (!create && isNotFoundError(error)) return undefined;
        throw error;
    }
}

function assertPathSegment(value: string) {
    if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
        throw new Error("invalid_upload_artifact_id");
    }
}

function isNotFoundError(error: unknown) {
    return error instanceof DOMException && error.name === "NotFoundError";
}
