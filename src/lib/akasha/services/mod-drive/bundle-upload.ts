import {
    attachArchiveMetadata,
    parseResourceReferences,
    planBundles,
    resolveResourcePaths,
    writeZip64Archive,
    type BundleManifestV1,
} from "@nahida/sdk";
import { createSHA256 } from "hash-wasm";
import pLimit from "p-limit";

import type { FileInfoComponent } from "@/lib/workers/akasha.worker";

import { eden } from "@/lib/eden";

type UploadFile = FileInfoComponent & { parentId: string; sha256: string };

export async function uploadResourceBundles(params: {
    files: UploadFile[];
    collectionId: string;
    sig?: string;
    sessionId: string;
    progress: (files: number, bytes: number) => void;
    uploadStandalone: (files: UploadFile[]) => Promise<void>;
}) {
    const inventory = {
        files: params.files.map((file) => ({
            path: file.path,
            size: file.size,
            sha256: file.sha256,
        })),
    };
    const references = (
        await Promise.all(
            params.files
                .filter((file) => file.name.toLowerCase().endsWith(".ini"))
                .map(async (file) => parseResourceReferences(await file.file.text(), file.path)),
        )
    ).flat();
    const resolution = resolveResourcePaths(inventory, references);
    const bundlePlan = planBundles(inventory, resolution);
    const fatal = bundlePlan.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    if (fatal.length > 0) throw new Error(fatal.map((diagnostic) => diagnostic.message).join("\n"));

    const resourceHashes = new Set(bundlePlan.references.map((reference) => reference.fileId));
    const eligibleFiles = params.files.filter(
        (file) => resourceHashes.has(file.sha256) || isLegacyAllowed(file.name),
    );
    const planBody = {
        sessionId: params.sessionId,
        collectionId: params.collectionId,
        sig: params.sig,
        files: eligibleFiles.map((file) => ({
            path: file.path,
            size: file.size,
            sha256: file.sha256,
            mimeType: file.file.type || undefined,
            resource: resourceHashes.has(file.sha256),
        })),
        bundles: bundlePlan.bundles.map((bundle) => ({
            key: bundle.bundleId,
            sha256: bundle.entries.map((entry) => entry.sha256),
        })),
    };
    const planned = await requireData(await eden.akasha.mod.v2.plan.post(planBody), "bundle plan");
    const filePlans = new Map(
        planned.files.map((file) => [
            file.sha256.toLowerCase(),
            { ...file, fileId: "fileId" in file ? file.fileId : undefined },
        ]),
    );
    const filesByHash = new Map(eligibleFiles.map((file) => [file.sha256.toLowerCase(), file]));
    const standaloneFiles = eligibleFiles.filter((file) => !resourceHashes.has(file.sha256));
    const oversized = standaloneFiles.find((file) => file.size > 150 * 1000 * 1000);
    if (oversized) {
        throw new Error(`${oversized.name} 파일이 최대 파일 크기 제한인 150MiB를 초과합니다.`);
    }

    if (
        planned.files.some(
            (file) => file.resource && (file.state === "wait" || file.state === "retry"),
        )
    ) {
        throw new Error("같은 리소스가 다른 세션에서 처리 중입니다. 잠시 후 다시 시도해주세요.");
    }

    await params.uploadStandalone(standaloneFiles);

    for (const serverBundle of planned.bundles) {
        if (serverBundle.ownedFileIds.length === 0) continue;
        const sourcePlan = bundlePlan.bundles.find(
            (bundle) => bundle.bundleId === serverBundle.key,
        );
        if (!sourcePlan) throw new Error(`Missing client bundle plan: ${serverBundle.key}`);
        const owned = sourcePlan.entries
            .map((entry) => ({ entry, server: filePlans.get(entry.sha256) }))
            .filter((item): item is typeof item & { server: NonNullable<typeof item.server> } =>
                Boolean(
                    item.server?.fileId && serverBundle.ownedFileIds.includes(item.server.fileId),
                ),
            );
        if (owned.length === 0) continue;

        const manifest: BundleManifestV1 = {
            version: 1,
            bundleId: serverBundle.key,
            entries: owned.map((item) => ({ ...item.entry, fileId: item.server.fileId! })),
        };
        const opfsRoot = await navigator.storage.getDirectory();
        const archiveName = `.akasha-upload-${params.sessionId}-${serverBundle.key}.zip`;
        const archiveHandle = await opfsRoot.getFileHandle(archiveName, { create: true });
        try {
            const writable = await archiveHandle.createWritable();
            const writeResult = await writeZip64Archive(
                { writable },
                manifest,
                owned.map((item) => {
                    const file = filesByHash.get(item.entry.sha256);
                    if (!file) throw new Error(`Missing bundle source: ${item.entry.sha256}`);
                    return {
                        fileId: item.server.fileId!,
                        size: file.size,
                        method: item.entry.method,
                        stream: () => file.file.stream(),
                    };
                }),
            );
            const enriched = attachArchiveMetadata(manifest, writeResult);
            const archiveFile = await archiveHandle.getFile();
            const archiveSha256 = await hashFile(archiveFile);
            const init = await requireData(
                await eden.akasha.mod.v2.bundles.init.post({
                    sessionId: params.sessionId,
                    collectionId: params.collectionId,
                    sig: params.sig,
                    archiveSha256,
                    size: archiveFile.size,
                    manifest: {
                        version: 1,
                        entries: enriched.entries.map((entry) => ({
                            fileId: entry.fileId,
                            sha256: entry.sha256,
                            size: entry.size,
                            memberName: entry.fileId,
                            method: entry.method === "store" ? 0 : 8,
                            paths: [...entry.paths],
                            dataOffset: entry.dataOffset!,
                            compressedSize: entry.compressedSize!,
                            crc32: entry.crc32!,
                        })),
                    },
                }),
                "bundle init",
            );

            if (
                !(
                    (init.mode === "put" && typeof init.url === "string") ||
                    (init.mode === "multipart" &&
                        typeof init.partSize === "number" &&
                        Array.isArray(init.urls))
                )
            ) {
                throw new Error("Invalid bundle upload mode");
            }
            const parts = await uploadArchive(
                archiveFile,
                archiveSha256,
                init as
                    | { mode: "put"; url: string }
                    | { mode: "multipart"; partSize: number; urls: string[] },
            );
            await requireData(
                await eden.akasha.mod.v2.bundles({ id: init.bundleId }).complete.post({
                    sessionId: params.sessionId,
                    parts,
                }),
                "bundle completion",
            );
            await waitUntilVerified(init.uploadId);
        } finally {
            await opfsRoot.removeEntry(archiveName).catch(() => undefined);
        }
    }

    const resourceFiles = eligibleFiles.filter((file) => resourceHashes.has(file.sha256));
    if (resourceFiles.length > 0) {
        await requireData(
            await eden.akasha.mod.v2.finalize.post({
                sessionId: params.sessionId,
                collectionId: params.collectionId,
                sig: params.sig,
                files: resourceFiles.map((file) => {
                    const plannedFile = filePlans.get(file.sha256.toLowerCase());
                    if (!plannedFile?.fileId)
                        throw new Error(`Missing resource fileId: ${file.path}`);
                    return {
                        fileId: plannedFile.fileId,
                        parentId: file.parentId,
                        name: file.name,
                        size: file.size,
                    };
                }),
            }),
            "bundle finalize",
        );
        params.progress(
            resourceFiles.length,
            resourceFiles.reduce((sum, file) => sum + file.size, 0),
        );
    }

    return {
        standaloneFiles,
        diagnostics: bundlePlan.diagnostics,
        totalFiles: eligibleFiles.length,
        totalBytes: eligibleFiles.reduce((sum, file) => sum + file.size, 0),
    };
}

async function uploadArchive(
    archive: File,
    archiveSha256: string,
    init: { mode: "put"; url: string } | { mode: "multipart"; partSize: number; urls: string[] },
) {
    if (init.mode === "put") {
        const response = await fetch(init.url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/zip",
                "x-amz-checksum-sha256": hexToBase64(archiveSha256),
            },
            body: archive,
        });
        if (!response.ok) throw new Error(`Bundle PUT failed: ${response.status}`);
        return [];
    }

    const limit = pLimit(3);
    return Promise.all(
        init.urls.map((url, index) =>
            limit(async () => {
                const response = await fetch(url, {
                    method: "PUT",
                    body: archive.slice(
                        index * init.partSize,
                        Math.min((index + 1) * init.partSize, archive.size),
                    ),
                });
                if (!response.ok)
                    throw new Error(`Bundle part ${index + 1} failed: ${response.status}`);
                const etag = response.headers.get("ETag");
                if (!etag) throw new Error(`Bundle part ${index + 1} did not return ETag`);
                return { partNumber: index + 1, etag };
            }),
        ),
    );
}

async function waitUntilVerified(uploadId: string) {
    for (let attempt = 0; attempt < 300; attempt++) {
        const status = await requireData(
            await eden.akasha.mod.v2.uploads({ id: uploadId }).get(),
            "bundle status",
        );
        if (status.status === "verified" || status.bundle.status === "verified") return;
        if (status.status === "failed" || status.bundle.status === "failed") {
            throw new Error("Bundle verification failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Bundle verification timed out");
}

async function hashFile(file: File) {
    const hasher = await createSHA256();
    hasher.init();
    const reader = file.stream().getReader();
    while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        hasher.update(chunk.value);
    }
    return hasher.digest("hex");
}

async function requireData<T>(result: { data: T; error: unknown }, operation: string) {
    if (result.error || result.data == null) throw new Error(`${operation} failed`);
    return result.data;
}

function hexToBase64(hex: string) {
    const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
    return btoa(String.fromCharCode(...bytes));
}

function isLegacyAllowed(name: string) {
    return /\.(?:buf|ib|vb|dds|ini|jpe?g|png|webp|gif|avifs?|bmp|hlsl|py|json|txt|pmx|tga|spa|assets|wem|mp4|webm|blend|pck)$/iu.test(
        name,
    );
}
