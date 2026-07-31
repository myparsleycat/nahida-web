export interface Ancestor {
    id: string;
    parentId: string | null;
    name: string;
    depth: number;
}

interface ImportProgressData {
    depth: number;
    processedDirs: number;
    processedFiles: number;
    currentTotalSize: number;
    batchIndex: number;
    totalBatchesInDepth: number;
}

interface ImportCompleteData {
    status: "success";
    totalSize: number;
    totalFiles: number;
    totalDirs: number;
}

export interface ImportSSEMessage {
    event: "status" | "progress" | "complete" | "error";
    data: ImportProgressData | ImportCompleteData | string;
}

export type ImportEvent =
    | { event: "metadata"; data: { totalExpectedSize: number } }
    | { event: "status"; data: string }
    | {
          event: "progress";
          data: {
              depth: number;
              processedDirs: number;
              processedFiles: number;
              currentTotalSize: number;
              batchIndex: number;
              totalBatchesInDepth: number;
          };
      }
    | {
          event: "complete";
          data: { status: "success"; totalSize: number; totalFiles: number; totalDirs: number };
      }
    | { event: "error"; data: string };
