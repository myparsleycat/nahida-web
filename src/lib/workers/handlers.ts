import type {
    CreateDirAction,
    CreateDirCompleteMessage,
    DeleteManyAction,
    DeleteManyCompleteMessage,
    DownloadFileAction,
    DownloadFileCompleteMessage,
    DirectoryInfo,
    ErrorMessage,
    ProgressMessage,
    RestoreManyAction,
    RestoreManyCompleteMessage,
    TrashManyAction,
    TrashManyCompleteMessage,
} from "./types";

import { eden } from "../eden";
import { normalizePath } from "../utils";
import { Semaphore } from "./semaphore";

export async function handleCreateDir(
    action: CreateDirAction,
    semaphore: Semaphore,
    dirIdMap: Map<string, string>,
) {
    const { directories, parentUUID, pid } = action;
    const createdDirectories: string[] = [];
    dirIdMap.clear();
    dirIdMap.set(normalizePath(""), parentUUID);

    try {
        const totalDirs = directories.length;
        let processedDirs = 0;

        const dirLevels: DirectoryInfo[][] = [];
        directories.forEach((dir) => {
            const depth = dir.path.split("/").length - 1;
            if (!dirLevels[depth]) dirLevels[depth] = [];
            dirLevels[depth].push(dir);
        });

        for (const levelDirs of dirLevels) {
            if (!levelDirs) continue;

            const parentGroups: { [parentPath: string]: DirectoryInfo[] } = {};
            levelDirs.forEach((dir) => {
                if (!parentGroups[dir.parentPath]) parentGroups[dir.parentPath] = [];
                parentGroups[dir.parentPath].push(dir);
            });

            for (const [parentPath, groupDirs] of Object.entries(parentGroups)) {
                const parentId = dirIdMap.get(normalizePath(parentPath));
                if (!parentId) {
                    throw new Error(`Parent directory ID not found for path: ${parentPath}`);
                }

                try {
                    await semaphore.acquire();
                    let newDirs: { path: string; name: string; uuid: string }[];
                    try {
                        const { data, error } = await eden.akasha.dir.create_many.post({
                            dirs: groupDirs.map((dir) => ({
                                path: dir.path,
                                name: dir.name,
                            })),
                            parentId,
                        });

                        if (error) {
                            throw new Error(error.value.toString());
                        }

                        newDirs = data.directories;
                    } finally {
                        semaphore.release();
                    }

                    newDirs.forEach(({ path, name, uuid }) => {
                        dirIdMap.set(normalizePath(path), uuid);
                        createdDirectories.push(uuid);

                        processedDirs++;
                        self.postMessage({
                            type: "progress",
                            action: action.action,
                            pid,
                            current: processedDirs,
                            total: totalDirs,
                            path,
                            success: true,
                        } as ProgressMessage);
                    });
                } catch (error) {
                    throw new Error(
                        `Failed to create directories under parent: ${parentPath} - ${error}`,
                    );
                }
            }
        }

        self.postMessage({
            type: "complete",
            action: action.action,
            pid,
            success: true,
            createdDirectories,
        } as CreateDirCompleteMessage);
    } catch (error) {
        self.postMessage({
            type: "error",
            pid,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        } as ErrorMessage);
    }
}

export async function handleTrashMany(action: TrashManyAction, semaphore: Semaphore) {
    try {
        const { uuids } = action;
        await semaphore.acquire();

        const { error } = await eden.akasha.content.trash.trash_many.post({
            uuids,
        });

        if (error) {
            throw new Error(error.value.toString());
        }

        self.postMessage({
            type: "complete",
            action: "trash_many",
            success: true,
            trashedUUIDs: uuids,
            pid: "",
        } satisfies TrashManyCompleteMessage);
    } catch (err: any) {
        self.postMessage({
            type: "error",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error occurred",
        } satisfies ErrorMessage);
    } finally {
        semaphore.release();
    }
}

export async function handleRestoreMany(action: RestoreManyAction, semaphore: Semaphore) {
    try {
        const { uuids } = action;
        await semaphore.acquire();

        const { error } = await eden.akasha.content.trash.restore_many.post({
            uuids,
        });

        // @ts-ignore
        if (error) {
            throw new Error(error.value.toString());
        }

        self.postMessage({
            type: "complete",
            action: "restore_many",
            success: true,
            restoredUUIDs: uuids,
            pid: "",
        } satisfies RestoreManyCompleteMessage);
    } catch (err: any) {
        self.postMessage({
            type: "error",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error occurred",
        } satisfies ErrorMessage);
    } finally {
        semaphore.release();
    }
}

export async function handleDeleteMany(action: DeleteManyAction, semaphore: Semaphore) {
    try {
        const { uuids } = action;
        await semaphore.acquire();

        const { error } = await eden.akasha.content.delete_many.post({
            uuids,
        });

        if (error) {
            throw new Error(error.value.toString());
        }

        self.postMessage({
            type: "complete",
            action: "delete_many",
            success: true,
            deletedUUIDs: uuids,
            pid: "",
        } satisfies DeleteManyCompleteMessage);
    } catch (error) {
        self.postMessage({
            type: "error",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        } satisfies ErrorMessage);
    } finally {
        semaphore.release();
    }
}

export async function handleDownloadFile(action: DownloadFileAction, semaphore: Semaphore) {
    try {
        const { uuid, name } = action;
        await semaphore.acquire();

        const getFile = async (uuid: string) => {
            const { data, error } = await eden.akasha.file({ uuid }).get();

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        };

        const file = await getFile(uuid);
        if (!file) {
            throw new Error("다운로드 URL 가져오는데 실패함");
        }

        self.postMessage({
            type: "complete",
            action: "download:file",
            success: true,
            uuid,
            name,
            url: file.url,
            compAlg: file.compAlg,
        } as DownloadFileCompleteMessage);
    } catch (err: any) {
        self.postMessage({
            type: "error",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error occurred",
        } as ErrorMessage);
    } finally {
        semaphore.release();
    }
}
