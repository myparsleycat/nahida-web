export type UploadKind = "drive" | "mod";

export type UploadTargetStatus =
    | "staging"
    | "hashing"
    | "planning"
    | "pending"
    | "uploading"
    | "staged"
    | "completing"
    | "created"
    | "exists"
    | "completed"
    | "denied"
    | "failed"
    | "paused"
    | "cancelled";

export type UploadSessionStatus =
    | "staging"
    | "creating_directories"
    | "hashing"
    | "planning"
    | "uploading"
    | "completed"
    | "partial"
    | "failed"
    | "paused"
    | "cancelled";

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
    bundleId?: string;
    updatedAt: number;
}

export interface PersistedNteBundle {
    id: string;
    memberClientIds: string[];
    completeUrl: string;
    abortUrl: string;
    token: string;
    state: "pending" | "completing" | "completed" | "paused" | "failed" | "cancelled";
    reason?: string;
    updatedAt: number;
}

export interface PersistedUploadIntent {
    requestId: string;
    intentId: string;
    url: string;
    token: string;
    sha256: string;
    state: "pending" | "uploading" | "completing" | "completed" | "paused" | "failed" | "cancelled";
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
    nteBundles?: PersistedNteBundle[];
    reason?: string;
    errorCode?: string;
    leaseOwner?: string;
    leaseUntil?: number;
}

export interface UploadPlanItem {
    clientId: string;
    status: "created" | "pending" | "exists" | "denied" | "error";
    reason?: string;
    itemId?: string;
    intentId?: string;
    bundleId?: string;
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
    nteBundles?: UploadPlanNteBundle[];
}

export interface UploadPlanNteBundle {
    id: string;
    memberClientIds: string[];
    completeUrl: string;
    abortUrl: string;
    form: { token: string };
}

export interface UploadSessionSnapshot {
    session: PersistedUploadSession;
    targets: PersistedUploadTarget[];
    intents: PersistedUploadIntent[];
}
