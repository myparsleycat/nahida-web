import { delay, sumBy, orderBy, groupBy, chunk } from "es-toolkit";
import i18n from "i18next";
import pLimit from "p-limit";
import { toast } from "sonner";

import type { FileInfoComponent } from "@/lib/workers/akasha.worker";

import { type Content } from "@/lib/akasha/types";
import { eden } from "@/lib/eden";
import { compressData, validateExt } from "@/lib/utils";
import sha256worker from "@/lib/workers/akasha.sha256.worker?worker";
import { modStore } from "@/stores/akasha-mod.store";

import { isPreviewFile, reverseFileContent } from "../drive-common";
import { collectDirectoryStructure, collectFiles, isNameConflict } from "../fs";

const CHUNK_SIZE = 100;

interface BaseProps {
    collectionId: string;
    sig?: string;
}

interface ParentIdFiles extends FileInfoComponent {
    parentId: string;
}

interface FinalFile extends ParentIdFiles {
    sha256: string;
}

const CORES = navigator.hardwareConcurrency || 4;

const createSha256WorkerPool = (size: number) => {
    const workers: Worker[] = [];
    for (let i = 0; i < size; i++) {
        const worker = new sha256worker();
        workers.push(worker);
    }
    return workers;
};

const cleanupSha256Workers = (workers: Worker[]) => {
    workers.forEach((worker) => {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
    });
};

async function calculateHashes(files: ParentIdFiles[]) {
    const optimalWorkerCount = Math.min(files.length, CORES);

    const workers = createSha256WorkerPool(optimalWorkerCount);
    const chunks: ParentIdFiles[][] = Array(optimalWorkerCount)
        .fill(null)
        .map(() => []);

    files.forEach((file, index) => {
        const workerIndex = index % optimalWorkerCount;
        chunks[workerIndex].push(file);
    });

    try {
        const results = await Promise.all(
            chunks.map((chunk, workerIndex) => {
                return new Promise<Map<string, string>>((resolve, reject) => {
                    const worker = workers[workerIndex];

                    worker.onmessage = (e) => {
                        if (e.data.type === "complete") {
                            resolve(new Map(e.data.hashes));
                        } else if (e.data.type === "error") {
                            reject(e.data.error);
                        }
                    };

                    worker.onerror = (error) => {
                        reject(error);
                    };

                    worker.postMessage({
                        files: chunk.map((f) => ({
                            FID: f.FID,
                            file: f.file,
                        })),
                    });
                });
            }),
        );

        const combinedHashes = new Map<string, string>();
        results.forEach((result) => {
            result.forEach((hash, fid) => {
                combinedHashes.set(fid, hash);
            });
        });

        const newFilesWithHashes = files.map((file) => {
            const hash = combinedHashes.get(file.FID);
            if (!hash) throw new Error("cannot get hash from FID");
            return {
                ...file,
                sha256: hash,
            };
        });

        return newFilesWithHashes;
    } finally {
        cleanupSha256Workers(workers);
    }
}

interface UploadPreparationResult {
    allFiles: FileInfoComponent[];
    allDirectories: { path: string; name: string; parentPath: string }[];
    totalSize: number;
    processName: string;
}

async function prepareUploadData(
    entries: FileSystemEntry[],
    items: Content[],
): Promise<UploadPreparationResult> {
    if (entries.length === 1 && entries[0].isFile) {
        const fileEntry = entries[0] as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
        if (!validateExt(file.name, [".blend"])) {
            throw new Error(i18n.t("drive.not_validateExt.1"));
        }
    }

    const collectedFiles = await Promise.all(
        entries.map((entry) => collectFiles(entry, undefined, [".blend"])),
    );
    const allFiles = collectedFiles.flat();

    const largeFile = allFiles.find((v) => v.size > 150 * 1000 * 1000);
    if (largeFile) {
        throw new Error(`${largeFile.name} 파일이 최대 파일 크기 제한인 150MiB를 초과합니다.`);
    }

    const directories = entries.filter(
        (entry): entry is FileSystemDirectoryEntry => entry.isDirectory,
    );
    const collectedDirs = await Promise.all(
        directories.map((dir) => collectDirectoryStructure(dir)),
    );
    const allDirectories = collectedDirs.flat();

    let processName: string;
    if (entries.length === 1) {
        processName = entries[0].name;
    } else {
        const folderNames = orderBy(allDirectories, [(dir) => dir.name], ["desc"]).map(
            (dir) => dir.name,
        );

        processName =
            folderNames.length > 0
                ? `${folderNames[0]} 외 ${entries.length - 1}개`
                : `${entries[0].name} 외 ${entries.length - 1}개`;
    }

    if (isNameConflict(items, processName)) {
        throw new Error("업로드하려는 대상과 동일한 이름을 가진 폴더/파일이 있습니다");
    }

    const totalSize = sumBy(allFiles, (fileInfo) => fileInfo.file.size);

    return { allFiles, allDirectories, totalSize, processName };
}

async function createDirectoriesOnServer(
    directories: { path: string; name: string; parentPath: string }[],
    props: { current: string; collectionId: string; sig?: string },
): Promise<{ id: string; path: string }[]> {
    if (directories.length === 0) {
        return [];
    }
    const { current, collectionId, sig } = props;
    const { data, error } = await eden.akasha.mod.create_dirs.post({
        current,
        collectionId,
        sig,
        dirs: directories,
    });
    if (error) {
        throw new Error(error.value.toString());
    }
    return data;
}

function mapFilesToParentIds(
    files: FileInfoComponent[],
    createdDirs: { id: string; path: string }[],
    defaultParentId: string,
): ParentIdFiles[] {
    if (createdDirs.length > 0) {
        const sortedDirs = orderBy(createdDirs, [(dir) => dir.path.length], ["desc"]);
        return files.map((file) => {
            const parentDir = sortedDirs.find(
                (dir) => file.path.substring(0, file.path.lastIndexOf("/")) === dir.path,
            );
            return { ...file, parentId: parentDir ? parentDir.id : defaultParentId };
        });
    } else {
        return files.map((file) => ({ ...file, parentId: defaultParentId }));
    }
}

type modStoreType = ReturnType<typeof modStore.getState>;
type ProgressUpdaters = {
    setSentItems: modStoreType["setSentItems"];
    setSentBytes: modStoreType["setSentBytes"];
    setProgress: modStoreType["setProgress"];
};

async function handleFileUploads(
    files: FinalFile[],
    baseProps: BaseProps,
    progressUpdaters: ProgressUpdaters,
    totalSize: number,
) {
    const { collectionId, sig } = baseProps;
    const { setSentItems, setSentBytes, setProgress } = progressUpdaters;
    let cumulativeSentBytes = 0;
    let cumulativeSentItems = 0;

    const updateProgress = (count: number, size: number) => {
        cumulativeSentItems += count;
        cumulativeSentBytes += size;
        setSentItems(cumulativeSentItems);
        setSentBytes(cumulativeSentBytes);
        if (totalSize > 0) {
            setProgress(Math.round((cumulativeSentBytes / totalSize) * 100));
        }
    };

    const hashGroups = groupBy(files, (file) => (file.sha256 ? file.sha256 : "unknown"));

    const representativeFiles: FinalFile[] = [];
    const allRemainingFiles: FinalFile[] = [];

    Object.values(hashGroups).forEach((group) => {
        if (group.length > 0) {
            representativeFiles.push(group[0]);
            if (group.length > 1) {
                allRemainingFiles.push(...group.slice(1));
            }
        }
    });

    const processAndUploadChunk = async (chunk: FinalFile[]) => {
        if (chunk.length === 0) return;

        const fileMetadatas = chunk.map((f) => ({
            parentId: f.parentId,
            name: f.name,
            path: f.path,
            size: f.size,
            sha256: f.sha256,
        }));
        const { data, error } = await eden.akasha.mod.create_files.post({
            collectionId,
            sig,
            files: fileMetadatas,
        });
        if (error) {
            throw new Error(`[create_files chunk failed] ${error.value.toString()}`);
        }

        const serverNeedsSha256 = new Set(data.map((item) => item.form.sha256));

        const filesToUpload: FinalFile[] = [];
        let createdCount = 0;
        let createdSize = 0;

        chunk.forEach((file) => {
            if (serverNeedsSha256.has(file.sha256)) {
                filesToUpload.push(file);
            } else {
                createdCount++;
                createdSize += file.file.size;
            }
        });

        if (createdCount > 0) {
            updateProgress(createdCount, createdSize);
        }

        if (filesToUpload.length > 0) {
            await performFileUploads({ collectionId, sig, files: filesToUpload });
            const uploadedSize = sumBy(filesToUpload, (file) => file.file.size);
            updateProgress(filesToUpload.length, uploadedSize);
        }
    };

    const representativeChunks = chunk(representativeFiles, CHUNK_SIZE);
    for (const fileChunk of representativeChunks) {
        await processAndUploadChunk(fileChunk);
    }

    const remainingChunks = chunk(allRemainingFiles, CHUNK_SIZE);
    for (const fileChunk of remainingChunks) {
        await processAndUploadChunk(fileChunk);
    }
}

interface uploadFileProps extends BaseProps {
    file: FinalFile;
}

async function uploadFile({ collectionId, sig, file }: uploadFileProps) {
    const { name, size, sha256, parentId } = file;

    const isPreview = await isPreviewFile(file.file);
    let zstdFile: File | undefined = undefined;

    if (!isPreview && file.size > 100) {
        const buffer = await file.file.arrayBuffer();
        const { compressedData } = await compressData(buffer, "zstd");

        if (compressedData) {
            const blob = new Blob([new Uint8Array(compressedData)]);
            zstdFile = new File([blob], name);
        }
    }

    const compAlg = zstdFile ? "zstd" : undefined;
    const initialFile = zstdFile || file.file;

    const MAX_RETRIES = 3;
    let fileToUpload = initialFile;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { error } = await eden.akasha.mod.upload.post({
                name: name,
                size: size,
                sha256: sha256,
                parentId: parentId,
                file: fileToUpload,
                collectionId,
                sig,
                ...(compAlg && { compAlg }),
            });

            if (!error) {
                return;
            }

            if (attempt === MAX_RETRIES) {
                throw new Error(
                    `Upload failed after ${MAX_RETRIES} attempts: ${error.value.toString()}`,
                );
            }

            if (error.status === 403) {
                const reversedBlob: Blob = await reverseFileContent(fileToUpload);
                fileToUpload = new File([reversedBlob], name);
            }

            await delay(1000 * attempt);
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                throw error;
            }
            await delay(1000 * attempt);
        }
    }
}

interface performFileUploadsProps extends BaseProps {
    files: FinalFile[];
}

async function performFileUploads({ collectionId, sig, files }: performFileUploadsProps) {
    const limit = pLimit(20);

    const tasks = files.map((file) => {
        return limit(() =>
            uploadFile({
                collectionId,
                sig,
                file,
            }),
        );
    });

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        throw new Error(`${failed.length}개 파일 업로드 실패`);
    }
}

interface startUploadProps {
    items: Content[];
    entries: FileSystemEntry[];
    current: string;
    collectionId: string;
    sig?: string;
}

export async function startUpload(props: startUploadProps) {
    const { items, entries, current, collectionId, sig } = props;
    const {
        setStatus,
        setTotalBytes,
        setTotalItems,
        setProgress,
        setSentBytes,
        setSentItems,
        clear,
    } = modStore.getState();

    try {
        clear();
        setStatus("collecting");
        setTotalItems(0);
        setTotalBytes(0);
        setProgress(0);
        setSentItems(0);
        setSentBytes(0);

        const { allFiles, allDirectories, totalSize } = await prepareUploadData(entries, items);
        setTotalItems(allFiles.length);
        setTotalBytes(totalSize);

        if (allFiles.length === 0 && allDirectories.length === 0) {
            toast.info("업로드할 유효한 파일이 없습니다.");
            return;
        }

        const createdDirs = await createDirectoriesOnServer(allDirectories, {
            current,
            collectionId,
            sig,
        });

        if (allFiles.length > 0) {
            const parentIdProcessedFiles = mapFilesToParentIds(allFiles, createdDirs, current);

            setStatus("hashing");
            const finalFiles = await calculateHashes(parentIdProcessedFiles);

            setStatus("transmitting");
            await handleFileUploads(
                finalFiles,
                { collectionId, sig },
                { setSentItems, setSentBytes, setProgress },
                totalSize,
            );
        }
    } catch (e: any) {
        toast.error(e.message);
        throw e;
    } finally {
        await delay(1000);
        clear();
    }
}
