import { isPreviewFile } from "@/lib/akasha/services/drive-common";

import type { FileInfoWorker, ProcessStatus } from "../types";
import type { SpeedMonitor } from "./speed-monitor";

import { eden } from "../../eden";
import { calculateHashesInParallel } from "./hash-pool";
import { createUploadCore, processCreateManyResults } from "./upload-core";

interface OrchestratorDeps {
    pid: string;
    current: string;
    compAlg?: "zstd" | "gzip" | null;
    speedMonitor: SpeedMonitor;
    setStatus: (status: ProcessStatus, current?: number, total?: number) => void;
    onFileUploaded: (fileId: string) => void;
}

export async function processUpload(files: FileInfoWorker[], deps: OrchestratorDeps) {
    const { performParallelUploads } = createUploadCore({
        compAlg: deps.compAlg,
        updateProgress: (fileId, uploadedBytes, totalBytes, isActive) => {
            deps.speedMonitor.updateProgress(fileId, uploadedBytes, totalBytes, isActive);
            deps.speedMonitor.postGlobalProgress(deps.pid, totalBytes);
        },
    });

    deps.setStatus("uploading", 0, files.length);
    deps.speedMonitor.start(deps.pid);

    try {
        await processInChunksAndUpload(files, 1024, {
            current: deps.current,
            setStatus: deps.setStatus,
            onFileUploaded: deps.onFileUploaded,
            performParallelUploads,
        });
    } catch {
        deps.setStatus("failed");
    } finally {
        deps.speedMonitor.stop();
    }

    return Array.from(new Set(files.map((f) => f.FID)));
}

interface ChunkProcessingDeps {
    current: string;
    setStatus: (status: ProcessStatus, current?: number, total?: number) => void;
    onFileUploaded: (fileId: string) => void;
    performParallelUploads: ReturnType<typeof createUploadCore>["performParallelUploads"];
}

async function processInChunksAndUpload(
    files: FileInfoWorker[],
    chunkSizeMB: number = 500,
    deps: ChunkProcessingDeps,
) {
    const chunkSizeBytes = chunkSizeMB * 1024 * 1024;

    deps.setStatus("hash-calculation", 0, files.length);

    const hashResults = await calculateHashesInParallel(files, (completed, total) => {
        deps.setStatus("hash-calculation", completed, total);
    });

    if (hashResults.size === 0) {
        throw new Error("파일 해시 계산 실패");
    }

    const fileHashes = new Map(hashResults);

    const hashGroups = files.reduce((groups, file) => {
        const hash = fileHashes.get(file.FID);
        if (!hash) return groups;
        const existing = groups.get(hash);
        if (existing) {
            existing.push(file);
        } else {
            groups.set(hash, [file]);
        }
        return groups;
    }, new Map<string, FileInfoWorker[]>());

    const duplicateHashGroups = new Map<string, FileInfoWorker[]>();
    const uniqueHashFiles: FileInfoWorker[] = [];

    for (const [hash, group] of hashGroups) {
        if (group.length > 1) {
            duplicateHashGroups.set(hash, group);
        } else {
            uniqueHashFiles.push(group[0]);
        }
    }

    deps.setStatus("uploading", 0, files.length);

    const uploadedFileIds: string[] = [];

    if (duplicateHashGroups.size > 0) {
        const representativeFiles = Array.from(duplicateHashGroups.values()).map(
            (group) => group[0],
        );

        const repFileChunks = splitIntoChunks(representativeFiles, chunkSizeBytes);

        for (const chunk of repFileChunks) {
            const result = await processChunk(
                chunk,
                fileHashes,
                deps,
                files.length,
                uploadedFileIds,
            );
            uploadedFileIds.push(...result);
        }
    }

    const remainingDuplicateFiles = Array.from(duplicateHashGroups.values()).flatMap((group) =>
        group.slice(1),
    );

    const allRemainingFiles = [...remainingDuplicateFiles, ...uniqueHashFiles];

    const largeFiles: FileInfoWorker[] = [];
    const normalFiles: FileInfoWorker[] = [];

    const previewResults = await Promise.all(
        allRemainingFiles.map((file) => isPreviewFile(file.file)),
    );

    for (let i = 0; i < allRemainingFiles.length; i++) {
        if (!previewResults[i] && allRemainingFiles[i].file.size > chunkSizeBytes) {
            largeFiles.push(allRemainingFiles[i]);
        } else {
            normalFiles.push(allRemainingFiles[i]);
        }
    }

    const chunks: FileInfoWorker[][] = largeFiles.map((f) => [f]);

    const MAX_FILES_PER_CHUNK = 100;
    let currentChunk: FileInfoWorker[] = [];

    for (const file of normalFiles) {
        if (currentChunk.length >= MAX_FILES_PER_CHUNK) {
            chunks.push([...currentChunk]);
            currentChunk = [];
        }
        currentChunk.push(file);
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    for (const chunk of chunks) {
        const result = await processChunk(chunk, fileHashes, deps, files.length, uploadedFileIds);
        uploadedFileIds.push(...result);
    }
}

async function processChunk(
    chunk: FileInfoWorker[],
    fileHashes: Map<string, string>,
    deps: ChunkProcessingDeps,
    totalFiles: number,
    existingUploadedIds: string[],
): Promise<string[]> {
    const processedFiles = chunk
        .map((f) => ({
            FID: f.FID,
            name: f.name,
            sha256: fileHashes.get(f.FID) || "",
            size: f.file.size,
            parentId: f.parentId,
        }))
        .filter((f) => f.sha256);

    const { data, error } = await eden.akasha.file.create_many.post({
        current: deps.current,
        files: processedFiles,
    });

    if (error) {
        console.error("create_many API 오류:", error.value);
        return [];
    }

    const createManyResults = data || [];
    const filesToUpload = processCreateManyResults(createManyResults, chunk);
    const createdFiles = filesToUpload.filter((entry) => entry.status === "created");
    const filesToActuallyUpload = filesToUpload.filter(
        (fileInfo) => fileInfo.status !== "created" && fileInfo.form,
    );

    const createdFileIds = createdFiles.map((entry) => entry.FID);
    createdFileIds.forEach((fid) => deps.onFileUploaded(fid));
    deps.setStatus("uploading", existingUploadedIds.length + createdFileIds.length, totalFiles);

    const newUploadedIds = await deps.performParallelUploads(
        filesToActuallyUpload,
        deps.onFileUploaded,
    );

    deps.setStatus(
        "uploading",
        existingUploadedIds.length + createdFileIds.length + newUploadedIds.length,
        totalFiles,
    );

    return [...createdFileIds, ...newUploadedIds];
}

function splitIntoChunks(files: FileInfoWorker[], chunkSizeBytes: number): FileInfoWorker[][] {
    const result: FileInfoWorker[][] = [];
    let currentChunk: FileInfoWorker[] = [];
    let currentChunkSize = 0;

    for (const file of files) {
        if (file.file.size > chunkSizeBytes) {
            if (currentChunk.length > 0) {
                result.push([...currentChunk]);
                currentChunk = [];
                currentChunkSize = 0;
            }
            result.push([file]);
        } else if (currentChunkSize + file.file.size > chunkSizeBytes) {
            result.push([...currentChunk]);
            currentChunk = [file];
            currentChunkSize = file.file.size;
        } else {
            currentChunk.push(file);
            currentChunkSize += file.file.size;
        }
    }

    if (currentChunk.length > 0) {
        result.push(currentChunk);
    }

    return result;
}
