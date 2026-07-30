export type UploadKind = "drive" | "mod";

export type UploadTargetStatus =
    | "staging"
    | "hashing"
    | "planning"
    | "pending"
    | "uploading"
    | "completing"
    | "created"
    | "exists"
    | "completed"
    | "denied"
    | "failed"
    | "paused"
    | "recovery_required";

export type UploadSessionStatus =
    | "staging"
    | "creating_directories"
    | "hashing"
    | "planning"
    | "uploading"
    | "completed"
    | "partial"
    | "failed"
    | "paused";

export interface PersistedUploadDirectory {
    path: string;
    name: string;
    parentPath: string;
    itemId?: string;
}

export interface PersistedUploadTarget {
    requestId: string;
    clientId: string;
    name: string;
    path: string;
    parentPath: string;
    parentId?: string;
    size: number;
    sha256?: string;
    status: UploadTargetStatus;
    reason?: string;
    itemId?: string;
    intentId?: string;
    sourcePath: string;
    updatedAt: number;
}

export interface PersistedUploadIntent {
    requestId: string;
    intentId: string;
    url: string;
    token: string;
    sha256: string;
    state: "pending" | "uploading" | "completing" | "completed" | "paused" | "failed";
    totalParts?: number;
    acknowledgedParts: number[];
    attemptCount: number;
    nextRetryAt?: number;
    compAlg?: "zstd";
    reverse?: boolean;
    updatedAt: number;
}

export interface PersistedUploadSession {
    requestId: string;
    kind: UploadKind;
    name: string;
    current: string;
    collectionId?: string;
    sig?: string;
    ownerUserId?: string;
    status: UploadSessionStatus;
    totalBytes: number;
    createdAt: number;
    updatedAt: number;
    directories: PersistedUploadDirectory[];
    reason?: string;
    leaseOwner?: string;
    leaseUntil?: number;
}

export interface UploadPlanItem {
    clientId: string;
    status: "created" | "pending" | "exists" | "denied" | "error";
    reason?: string;
    itemId?: string;
    intentId?: string;
}

export interface UploadPlanEntry {
    intentId: string;
    url: string;
    method: "POST";
    form: {
        token: string;
        sha256: string;
    };
}

export interface UploadPlanResponse {
    requestId: string;
    items: UploadPlanItem[];
    uploads: UploadPlanEntry[];
}

export interface UploadSessionSnapshot {
    session: PersistedUploadSession;
    targets: PersistedUploadTarget[];
    intents: PersistedUploadIntent[];
}
