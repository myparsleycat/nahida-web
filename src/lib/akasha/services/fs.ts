import type { Content } from "@/lib/akasha/types";
import type { FileInfoComponent } from "@/lib/workers/akasha.worker";

import type { DirectoryInfo } from "./fs.worker";

import fsWorker from "./fs.worker?worker";

export async function readAllEntries(
    reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
    const entries: FileSystemEntry[] = [];
    while (true) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, reject);
        });

        if (batch.length === 0) break;
        entries.push(...batch);
    }
    return entries;
}

export async function collectDirectoryStructure(
    entry: FileSystemDirectoryEntry,
    parentPath: string = "",
): Promise<{ path: string; name: string; parentPath: string }[]> {
    if (isSystemFile(entry.name)) return [];
    const result: { path: string; name: string; parentPath: string }[] = [];
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    result.push({
        path,
        name: entry.name,
        parentPath,
    });

    const reader = entry.createReader();
    const entries = await readAllEntries(reader);

    const subDirPromises = entries
        .filter((entry): entry is FileSystemDirectoryEntry => entry.isDirectory)
        .map((subDir) => collectDirectoryStructure(subDir, path));

    const subDirs = await Promise.all(subDirPromises);
    return result.concat(...subDirs);
}

const SYSTEM_FILE_PATTERNS = [
    /^\.DS_Store$/,
    /^\._/,
    /^\.AppleDouble$/,
    /^\.Spotlight-V100$/,
    /^\.Trashes$/,
    /^\.fseventsd$/,
    /^\.TemporaryItems$/,
    /^\.apdisk$/,
    /^__MACOSX$/,
    /^Thumbs\.db$/i,
    /^ehthumbs.*\.db$/i,
    /^desktop\.ini$/i,
    /^~$/,
];

export function isSystemFile(name: string) {
    return SYSTEM_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

export async function collectFiles(
    entry: FileSystemEntry,
    basePath: string = "",
    _additionalExt: string[] = [],
): Promise<FileInfoComponent[]> {
    if (entry.isFile) {
        if (isSystemFile(entry.name)) return [];
        const fileEntry = entry as FileSystemFileEntry;
        return new Promise((resolve) => {
            fileEntry.file((file) => {
                const path = basePath ? `${basePath}/${fileEntry.name}` : fileEntry.name;
                const parentPath = basePath || "";
                const clientId = crypto.randomUUID();
                resolve([
                    {
                        FID: clientId,
                        clientId,
                        path,
                        name: fileEntry.name,
                        size: file.size,
                        parentPath,
                        file,
                    },
                ]);
            });
        });
    }

    if (entry.isDirectory) {
        if (isSystemFile(entry.name)) return [];
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await readAllEntries(reader);

        const newBasePath = basePath ? `${basePath}/${dirEntry.name}` : dirEntry.name;

        const collectedFiles = await Promise.all(
            entries.map((entry) => collectFiles(entry, newBasePath)),
        );

        return collectedFiles.flat();
    }

    return [];
}

export function isNameConflict(childs: Content[], name: string) {
    return childs.some((child) => child.name === name);
}

export async function saveFile(data: Uint8Array, name: string): Promise<void> {
    const blob = new Blob([new Uint8Array(data)]);
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = name;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

async function getAllFiles(entries: FileSystemEntry[]): Promise<File[]> {
    const filePromises: Promise<File[]>[] = entries.map(async (entry) => {
        if (entry.isFile) {
            return new Promise<File[]>((resolve) => {
                (entry as FileSystemFileEntry).file((file) => resolve([file]));
            });
        }
        if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const subEntries = await readAllEntries(reader);
            return getAllFiles(subEntries);
        }
        return Promise.resolve([]);
    });

    const nestedFiles = await Promise.all(filePromises);
    return nestedFiles.flat();
}

export async function processEntriesWithWorker(
    entries: FileSystemEntry[],
): Promise<{ allFiles: FileInfoComponent[]; allDirectories: DirectoryInfo[] }> {
    const allFileObjects = await getAllFiles(entries);

    return new Promise((resolve, reject) => {
        const worker = new fsWorker();

        worker.onmessage = (event) => {
            const { allFiles, allDirectories } = event.data;
            resolve({ allFiles, allDirectories });
        };

        worker.onerror = (error) => {
            reject(error);
            worker.terminate();
        };

        worker.postMessage(allFileObjects);
    });
}
