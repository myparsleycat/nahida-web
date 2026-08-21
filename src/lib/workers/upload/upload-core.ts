import PQueue from "p-queue";

import { reverseFileContent } from "@/lib/akasha/services/drive-common";
import { shouldSkipUploadCompression } from "@/lib/akasha/upload-v2/compress";

import type { CreateManyResults, FileInfoWorker } from "../types";

import { eden2url } from "../../eden";
import { compressData } from "../../utils";

const UPLOAD_URL = eden2url.akasha.file.upload.url();
const CHUNK_SIZE = 25 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 80 * 1024 * 1024;
const RETRY_LIMIT = 3;

const splitFileIntoChunks = (file: File): Blob[] => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunks: Blob[] = [];

    for (let i = 0; i < totalChunks; i++) {
        chunks.push(file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size)));
    }

    return chunks;
};

export type ProcessedFileEntry = {
    FID: string;
    name: string;
    status: string;
    file: FileInfoWorker | undefined;
    size: number;
    form:
        | {
              parentId: string;
              sha256: string;
              name: string;
              key: string;
          }
        | undefined;
};

export function processCreateManyResults(
    results: CreateManyResults,
    sourceFiles: FileInfoWorker[],
): ProcessedFileEntry[] {
    return results.map((entry) => {
        const file = sourceFiles.find((f) => f.FID === entry.FID);
        return {
            FID: entry.FID,
            name: entry.name,
            status: entry.status,
            file,
            size: file?.size || 0,
            form: "form" in entry ? entry.form : undefined,
        };
    });
}

export interface UploadDeps {
    compAlg?: "zstd" | "gzip" | null;
    updateProgress: (
        fileId: string,
        uploadedBytes: number,
        totalBytes: number,
        isActive: boolean,
    ) => void;
}

export function createUploadCore(deps: UploadDeps) {
    const { compAlg, updateProgress } = deps;

    function prepareFormData(
        body: { parentId: string; sha256: string; name: string; key: string },
        partIndex?: number,
        totalParts?: number,
    ): FormData {
        const formData = new FormData();
        formData.append("sha256", body.sha256);
        formData.append("parent", body.parentId);
        formData.append("key", body.key);
        formData.append("name", body.name);

        if (partIndex !== undefined && totalParts !== undefined) {
            formData.append("part", `${partIndex}-${totalParts - 1}`);
        }

        return formData;
    }

    async function prepareFileForUpload(
        file: Blob | File,
        fileCompAlg: "zstd" | "gzip" | null | undefined,
        formData: FormData,
    ): Promise<Blob> {
        if (fileCompAlg && !(await shouldSkipUploadCompression(file))) {
            const buffer = await file.arrayBuffer();
            const { compressedData, isCompressed } = await compressData(buffer, fileCompAlg);

            if (!isCompressed || !compressedData) {
                throw new Error("compression_failed");
            }

            const blob = new Blob([compressedData as BlobPart]);
            formData.append("file", blob);
            formData.append("comp-alg", fileCompAlg);
            return blob;
        }

        formData.append("file", file);
        return file;
    }

    async function uploadReversed(
        file: Blob | File,
        fileName: string,
        fileCompAlg: "zstd" | "gzip" | null | undefined,
        body: { parentId: string; sha256: string; name: string; key: string },
        partIndex: number | undefined,
        totalParts: number | undefined,
        onProgress: ((loaded: number, total: number) => void) | undefined,
        updateFileProgress: () => void,
    ): Promise<boolean> {
        const reversedFile = await reverseFileContent(new File([file], fileName || "file"));

        const formData = prepareFormData(body, partIndex, totalParts);
        formData.append("file", reversedFile);
        formData.append("reverse", "true");

        if (fileCompAlg && !(await shouldSkipUploadCompression(reversedFile))) {
            formData.append("comp-alg", fileCompAlg);
        }

        return new Promise<boolean>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = onProgress
                ? (event) => {
                      if (event.lengthComputable) onProgress(event.loaded, event.total);
                  }
                : null;

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 524) {
                    updateFileProgress();
                    resolve(true);
                } else {
                    reject(new Error(`역순 업로드 실패: ${xhr.status}`));
                }
                xhr.onload = null;
                xhr.onerror = null;
                xhr.upload.onprogress = null;
            };

            xhr.onerror = () => {
                reject(new Error("역순 업로드 중 네트워크 오류"));
                xhr.onload = null;
                xhr.onerror = null;
                xhr.upload.onprogress = null;
            };

            xhr.withCredentials = true;
            xhr.open("POST", UPLOAD_URL);
            xhr.send(formData);
        });
    }

    const uploadFileOrChunk = async (
        body: { parentId: string; sha256: string; name: string; key: string },
        file: Blob | File,
        options: {
            FID: string;
            fileName?: string;
            partIndex?: number;
            totalParts?: number;
            compAlg?: "zstd" | "gzip" | null;
            previousProgress?: number;
            onProgress?: (loaded: number, total: number) => void;
        },
    ): Promise<boolean> => {
        const previousProgress = options.previousProgress ?? 0;

        for (let retryCount = 0; retryCount <= RETRY_LIMIT; retryCount++) {
            const result = await sendXhr(body, file, options, previousProgress, retryCount);
            if (result !== "retry") return result;

            await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
        }

        return false;
    };

    function sendXhr(
        body: { parentId: string; sha256: string; name: string; key: string },
        file: Blob | File,
        options: {
            FID: string;
            fileName?: string;
            partIndex?: number;
            totalParts?: number;
            compAlg?: "zstd" | "gzip" | null;
            previousProgress?: number;
            onProgress?: (loaded: number, total: number) => void;
        },
        previousProgress: number,
        retryCount: number,
    ): Promise<boolean | "retry"> {
        return new Promise<boolean | "retry">((resolve) => {
            const formData = prepareFormData(body, options.partIndex, options.totalParts);

            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = options.onProgress
                ? (event) => {
                      if (event.lengthComputable) options.onProgress!(event.loaded, event.total);
                  }
                : null;

            xhr.onloadstart = () => {
                updateProgress(options.FID, previousProgress, file.size, true);
            };

            xhr.onloadend = () => {
                updateProgress(options.FID, previousProgress + file.size, file.size, false);
                xhr.onload = null;
                xhr.onerror = null;
                xhr.upload.onprogress = null;
            };

            xhr.onload = () => {
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 524) {
                    resolve(true);
                } else if (xhr.status >= 500 && xhr.status < 600 && retryCount < RETRY_LIMIT) {
                    resolve("retry");
                } else if (xhr.status === 403) {
                    uploadReversed(
                        file,
                        options.fileName || "file",
                        options.compAlg,
                        body,
                        options.partIndex,
                        options.totalParts,
                        options.onProgress,
                        () =>
                            updateProgress(
                                options.FID,
                                previousProgress + file.size,
                                file.size,
                                false,
                            ),
                    ).then(resolve, (err: unknown) => {
                        console.error(
                            "파일 역순 변환 중 오류:",
                            err instanceof Error ? err.message : err,
                        );
                        resolve(false);
                    });
                } else {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        console.error(
                            `업로드 거부됨 (code: ${json.error?.code}, message: ${json.error?.message})`,
                        );
                    } catch {
                        console.error(`업로드 거부됨 (status: ${xhr.status})`);
                    }
                    resolve(false);
                }
            };

            xhr.onerror = () => {
                if (retryCount < RETRY_LIMIT) {
                    resolve("retry");
                } else {
                    console.error("업로드 중 네트워크 오류");
                    resolve(false);
                }
            };

            void (async () => {
                try {
                    await prepareFileForUpload(file, options.compAlg, formData);
                } catch (error) {
                    console.error(
                        "파일 압축 중 오류:",
                        error instanceof Error ? error.message : error,
                    );
                    resolve(false);
                    return;
                }
                xhr.withCredentials = true;
                xhr.open("POST", UPLOAD_URL);
                xhr.send(formData);
            })();
        });
    }

    const uploadLargeFile = async (fileInfo: {
        FID: string;
        name: string;
        status: string;
        file: FileInfoWorker;
        size: number;
        form: {
            parentId: string;
            sha256: string;
            name: string;
            key: string;
        };
    }): Promise<boolean> => {
        const { FID, form, file } = fileInfo;

        updateProgress(FID, 0, file.size, true);

        try {
            const chunks = splitFileIntoChunks(file.file);
            const totalChunks = chunks.length;
            const skipCompression = await shouldSkipUploadCompression(file.file);

            for (let i = 0; i < totalChunks; i++) {
                const previousProgress = i * CHUNK_SIZE;

                const chunkSuccess = await uploadFileOrChunk(form, chunks[i], {
                    FID,
                    fileName: fileInfo.name,
                    partIndex: i,
                    totalParts: totalChunks,
                    compAlg: skipCompression ? undefined : compAlg,
                    previousProgress,
                    onProgress: (loaded) => {
                        updateProgress(FID, previousProgress + loaded, file.size, true);
                    },
                });

                if (!chunkSuccess) {
                    updateProgress(FID, previousProgress, file.size, false);
                    return false;
                }
            }

            updateProgress(FID, file.size, file.size, false);
            return true;
        } catch (err: unknown) {
            console.error("대용량 파일 업로드 오류:", err instanceof Error ? err.message : err);
            updateProgress(FID, 0, file.size, false);
            return false;
        }
    };

    const performParallelUploads = async (
        filesToUpload: ProcessedFileEntry[],
        onFileUploaded: (fid: string) => void,
    ): Promise<string[]> => {
        const queue = new PQueue({ concurrency: 8 });
        const uploadedFileIds: string[] = [];

        const processUploadTask = async (fileInfo: ProcessedFileEntry): Promise<void> => {
            try {
                if (fileInfo.status === "created" || !fileInfo.form || !fileInfo.file) {
                    onFileUploaded(fileInfo.FID);
                    uploadedFileIds.push(fileInfo.FID);
                    return;
                }

                const { FID, name, file, form, size } = fileInfo;
                const skipCompression = await shouldSkipUploadCompression(file.file);
                const success =
                    size >= LARGE_FILE_THRESHOLD && !skipCompression
                        ? await uploadLargeFile({
                              FID,
                              name,
                              status: fileInfo.status,
                              file,
                              size,
                              form,
                          })
                        : await uploadFileOrChunk(form, file.file, {
                              FID,
                              fileName: name,
                              compAlg: skipCompression ? undefined : compAlg,
                              onProgress: (loaded, total) => {
                                  updateProgress(FID, loaded, total, true);
                              },
                          });

                if (success) {
                    onFileUploaded(FID);
                    uploadedFileIds.push(FID);
                }
            } catch (err: unknown) {
                console.error(
                    `업로드 오류 (${fileInfo.FID}, ${fileInfo.name}):`,
                    err instanceof Error ? err.message : err,
                );
            }
        };

        for (const payload of filesToUpload) {
            void queue.add(() => processUploadTask(payload));
        }

        await queue.onIdle();

        return uploadedFileIds;
    };

    return { uploadFileOrChunk, uploadLargeFile, performParallelUploads };
}
