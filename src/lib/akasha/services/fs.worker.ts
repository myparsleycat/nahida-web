import type { FileInfoComponent } from "@/lib/workers/akasha.worker";

export interface DirectoryInfo {
    path: string;
    name: string;
    parentPath: string;
}

self.onmessage = (event: MessageEvent<File[]>) => {
    const files: File[] = event.data;

    const allFiles: FileInfoComponent[] = [];
    const directoryMap = new Map<string, DirectoryInfo>();

    for (const file of files) {
        const fullPath = file.webkitRelativePath;

        const pathParts = fullPath.split("/");
        const fileName = pathParts.pop()!;
        const parentDirectoryPath = pathParts.join("/");

        let currentPath = "";
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            const parentPath = i === 0 ? "" : pathParts.slice(0, i).join("/");
            currentPath = parentPath ? `${parentPath}/${part}` : part;

            if (!directoryMap.has(currentPath)) {
                directoryMap.set(currentPath, {
                    path: currentPath,
                    name: part,
                    parentPath: parentPath,
                });
            }
        }

        const clientId = crypto.randomUUID();
        allFiles.push({
            FID: clientId,
            clientId,
            path: fullPath,
            name: fileName,
            size: file.size,
            parentPath: parentDirectoryPath,
            file: file,
        });
    }

    const allDirectories = Array.from(directoryMap.values());

    self.postMessage({ allFiles, allDirectories });
};
