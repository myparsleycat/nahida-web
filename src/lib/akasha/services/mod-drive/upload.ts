import { orderBy, sumBy } from "es-toolkit";

import type { Content } from "@/lib/akasha/types";
import type { FileInfoComponent } from "@/lib/workers/akasha.worker";

import { startUploadSession } from "@/lib/akasha/upload-v2/session";
import { modStore } from "@/stores/akasha-mod.store";

import { collectDirectoryStructure, collectFiles, isNameConflict } from "../fs";

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
    const allFiles = (await Promise.all(entries.map((entry) => collectFiles(entry)))).flat();
    const allDirectories = (
        await Promise.all(
            entries
                .filter((entry): entry is FileSystemDirectoryEntry => entry.isDirectory)
                .map((directory) => collectDirectoryStructure(directory)),
        )
    ).flat();
    const processName =
        entries.length === 1
            ? entries[0].name
            : `${
                  orderBy(allDirectories, [(directory) => directory.name], ["desc"])[0]?.name ||
                  entries[0].name
              } 외 ${entries.length - 1}개`;

    if (isNameConflict(items, processName)) {
        throw new Error("name_conflict");
    }

    return {
        allFiles,
        allDirectories,
        totalSize: sumBy(allFiles, (file) => file.file.size),
        processName,
    };
}

export async function startUpload({
    items,
    entries,
    current,
    collectionId,
    sig,
}: {
    items: Content[];
    entries: FileSystemEntry[];
    current: string;
    collectionId: string;
    sig?: string;
}) {
    const upload = await prepareUploadData(entries, items);
    if (upload.allFiles.length === 0 && upload.allDirectories.length === 0) {
        throw new Error("empty_upload");
    }

    modStore.getState().setStatus("collecting");
    modStore.getState().setTotalItems(upload.allFiles.length);
    modStore.getState().setTotalBytes(upload.totalSize);

    try {
        return await startUploadSession({
            kind: "mod",
            name: upload.processName,
            current,
            collectionId,
            sig,
            files: upload.allFiles,
            directories: upload.allDirectories,
        });
    } finally {
        modStore.getState().clear();
    }
}
