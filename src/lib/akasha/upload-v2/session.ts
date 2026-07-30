import { groupBy, orderBy } from "es-toolkit";
import pLimit from "p-limit";

import type { DirectoryInfo, FileInfoComponent } from "@/lib/workers/akasha.worker";

import { queryClient } from "@/integrations/queryClient";
import { eden } from "@/lib/eden";
import { compressData } from "@/lib/utils";
import { calculateHashesInParallel } from "@/lib/workers/upload/hash-pool";
import {
    registerUploadSessionActions,
    uploadSessionStore,
} from "@/stores/akasha-upload-session.store";

import type {
    PersistedUploadDirectory,
    PersistedUploadIntent,
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadKind,
    UploadSessionSnapshot,
} from "./types";

import { isPreviewFile } from "../services/drive-common";
import {
    deleteUploadSessionArtifacts,
    deleteEncodedArtifact,
    ensureUploadStorage,
    readEncodedArtifact,
    readSourceArtifact,
    writeEncodedArtifact,
    writeSourceArtifact,
} from "./opfs";
import { planUploadSession } from "./planner";
import {
    applyUploadPlan,
    completeUploadIntentAttempt,
    hasCompleteDirectoryMapping,
    prepareUploadRetry,
} from "./policy";
import {
    acquireUploadSessionLease,
    deleteUploadIntent,
    deleteUploadSession,
    getUploadIntent,
    listIncompleteUploadSessionSnapshots,
    loadUploadSessionSnapshot,
    releaseUploadSessionLease,
    renewUploadSessionLease,
    saveUploadIntent,
    saveUploadIntents,
    saveUploadSession,
    saveUploadTargets,
} from "./repository";
import { uploadIntentBytes } from "./transport";

const LEASE_MS = 60_000;
const tabId = crypto.randomUUID();
const updates =
    typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel("akasha-upload-sessions");

if (updates) updates.onmessage = () => void hydrateUploadSessions();

registerUploadSessionActions({
    retry: retryUploadSession,
    dismiss: dismissUploadSession,
    replaceSource: replaceUploadSource,
});

export async function startPersistentUpload({
    kind,
    name,
    current,
    collectionId,
    sig,
    files,
    directories,
}: {
    kind: UploadKind;
    name: string;
    current: string;
    collectionId?: string;
    sig?: string;
    files: FileInfoComponent[];
    directories: DirectoryInfo[];
}) {
    const requestId = crypto.randomUUID();
    const now = Date.now();
    await ensureUploadStorage(files.reduce((total, file) => total + file.file.size, 0));

    const session: PersistedUploadSession = {
        requestId,
        kind,
        name,
        current,
        collectionId,
        sig,
        status: "staging",
        totalBytes: files.reduce((total, file) => total + file.file.size, 0),
        createdAt: now,
        updatedAt: now,
        directories: directories.map((directory) => ({ ...directory })),
    };
    const targets: PersistedUploadTarget[] = files.map((file) => ({
        requestId,
        clientId: file.clientId,
        name: file.name,
        path: file.path,
        parentPath: file.parentPath,
        size: file.file.size,
        status: "staging",
        sourcePath: `akasha_uploads/${requestId}/source/${file.clientId}`,
        updatedAt: now,
    }));

    await saveUploadSession(session);
    await saveUploadTargets(targets);
    await refreshSnapshot(requestId);

    try {
        for (const file of files) {
            await writeSourceArtifact(requestId, file.clientId, file.file);
        }
    } catch (error) {
        await saveUploadSession({
            ...session,
            status: "failed",
            reason: error instanceof Error ? error.message : "storage_unavailable",
            updatedAt: Date.now(),
        });
        await refreshSnapshot(requestId);
        throw error;
    }

    await runUploadSession(requestId);
    return requestId;
}

export async function hydrateUploadSessions() {
    const snapshots = await listIncompleteUploadSessionSnapshots();
    uploadSessionStore.getState().replaceSnapshots(snapshots);
    uploadSessionStore.getState().setHydrated(true);
    return snapshots;
}

export async function resumeIncompleteUploads() {
    const snapshots = await hydrateUploadSessions();
    for (const snapshot of orderBy(snapshots, [(item) => item.session.createdAt], ["asc"])) {
        if (snapshot.session.status === "completed") continue;
        void runUploadSession(snapshot.session.requestId);
    }
}

export async function retryUploadSession(requestId: string) {
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (!snapshot) return;
    const retry = prepareUploadRetry(snapshot);
    await Promise.all(
        retry.staleIntentIds.flatMap((intentId) => [
            deleteUploadIntent(requestId, intentId),
            deleteEncodedArtifact(requestId, intentId),
        ]),
    );
    await saveUploadTargets(retry.targets);
    await saveUploadSession({
        ...snapshot.session,
        status: "paused",
        reason: undefined,
        updatedAt: Date.now(),
    });
    await runUploadSession(requestId);
}

export async function dismissUploadSession(requestId: string) {
    await deleteUploadSessionArtifacts(requestId);
    await deleteUploadSession(requestId);
    uploadSessionStore.getState().removeSnapshot(requestId);
    updates?.postMessage({ requestId, type: "deleted" });
}

export async function replaceUploadSource(requestId: string, clientId: string, file: File) {
    const snapshot = await loadRequiredSnapshot(requestId);
    const target = snapshot.targets.find((item) => item.clientId === clientId);
    if (!target) throw new Error("upload_target_not_found");
    if (file.size !== target.size) throw new Error("source_size_mismatch");

    const hashes = await calculateHashesInParallel([{ FID: clientId, file }]);
    const sha256 = hashes.get(clientId);
    if (!sha256) throw new Error("source_hash_failed");
    if (target.sha256 && target.sha256.toLowerCase() !== sha256.toLowerCase()) {
        throw new Error("source_sha_mismatch");
    }

    await ensureUploadStorage(file.size);
    await writeSourceArtifact(requestId, clientId, file);
    await saveUploadTargets(
        snapshot.targets.map((item) =>
            item.clientId === clientId
                ? {
                      ...item,
                      sha256,
                      status: "paused" as const,
                      reason: undefined,
                      updatedAt: Date.now(),
                  }
                : item,
        ),
    );
    await saveUploadSession({
        ...snapshot.session,
        status: "paused",
        reason: undefined,
        updatedAt: Date.now(),
    });
    await refreshSnapshot(requestId);
    await runUploadSession(requestId);
}

async function runUploadSession(requestId: string) {
    return withUploadLock(requestId, async () => {
        const leased = await acquireUploadSessionLease({
            requestId,
            owner: tabId,
            ttlMs: LEASE_MS,
        });
        if (!leased) return;
        const leaseTimer = window.setInterval(
            () =>
                void renewUploadSessionLease({
                    requestId,
                    owner: tabId,
                    ttlMs: LEASE_MS,
                }),
            LEASE_MS / 3,
        );

        try {
            let snapshot = await loadRequiredSnapshot(requestId);
            snapshot = await ensureSources(snapshot);
            if (snapshot.targets.some((target) => target.status === "recovery_required")) return;
            snapshot = await ensureDirectories(snapshot);
            snapshot = await ensureHashes(snapshot);
            snapshot = await ensurePlan(snapshot);
            await uploadPlannedIntents(snapshot);
            await finalizeSession(await loadRequiredSnapshot(requestId));
        } catch (error) {
            const snapshot = await loadUploadSessionSnapshot(requestId);
            if (snapshot) {
                await saveUploadSession({
                    ...snapshot.session,
                    status: "failed",
                    reason: error instanceof Error ? error.message : "upload_failed",
                    updatedAt: Date.now(),
                });
                await refreshSnapshot(requestId);
            }
        } finally {
            window.clearInterval(leaseTimer);
            await releaseUploadSessionLease(requestId, tabId).catch(() => false);
        }
    });
}

async function ensureSources(snapshot: UploadSessionSnapshot): Promise<UploadSessionSnapshot> {
    const sources = await Promise.all(
        snapshot.targets.map(async (target) => ({
            target,
            source: await readSourceArtifact(target.requestId, target.clientId),
        })),
    );
    const verifiable = sources.filter(
        (entry): entry is { target: PersistedUploadTarget; source: File } =>
            Boolean(entry.source && entry.source.size === entry.target.size && entry.target.sha256),
    );
    const hashes = await calculateHashesInParallel(
        verifiable.map((entry) => ({ FID: entry.target.clientId, file: entry.source })),
    );
    const targets = sources.map(({ target, source }) => {
        const invalid =
            !source ||
            source.size !== target.size ||
            (target.sha256 &&
                hashes.get(target.clientId)?.toLowerCase() !== target.sha256.toLowerCase());
        if (!invalid) return target;
        return {
            ...target,
            status: "recovery_required" as const,
            reason: !source
                ? "source_missing"
                : source.size !== target.size
                  ? "source_size_mismatch"
                  : "source_sha_mismatch",
            updatedAt: Date.now(),
        };
    });
    await saveUploadTargets(targets);
    if (targets.some((target) => target.status === "recovery_required")) {
        await saveUploadSession({
            ...snapshot.session,
            status: "paused",
            reason: "source_missing",
            updatedAt: Date.now(),
        });
    }
    await refreshSnapshot(snapshot.session.requestId);
    return { ...snapshot, targets };
}

async function ensureDirectories(snapshot: UploadSessionSnapshot): Promise<UploadSessionSnapshot> {
    if (hasCompleteDirectoryMapping(snapshot)) return snapshot;
    const session = {
        ...snapshot.session,
        status: "creating_directories" as const,
        updatedAt: Date.now(),
    };
    await saveUploadSession(session);
    const directories =
        session.kind === "drive"
            ? await createDriveDirectories(session.current, session.directories)
            : await createModDirectories(session, session.directories);
    const parentIds = new Map(directories.map((directory) => [directory.path, directory.itemId!]));
    const targets = snapshot.targets.map((target) => {
        const parentId = target.parentPath ? parentIds.get(target.parentPath) : session.current;
        if (!parentId) throw new Error("directory_mapping_missing");
        return { ...target, parentId, updatedAt: Date.now() };
    });
    await saveUploadSession({ ...session, directories, updatedAt: Date.now() });
    await saveUploadTargets(targets);
    await refreshSnapshot(session.requestId);
    return { ...snapshot, session, targets };
}

async function createDriveDirectories(current: string, directories: PersistedUploadDirectory[]) {
    const pathIds = new Map<string, string>([["", current]]);
    const result: PersistedUploadDirectory[] = [];
    const levels = groupBy(directories, (directory) => directory.path.split("/").length);
    for (const depth of Object.keys(levels)
        .map(Number)
        .sort((a, b) => a - b)) {
        const groups = groupBy(levels[depth], (directory) => directory.parentPath);
        for (const [parentPath, entries] of Object.entries(groups)) {
            const parentId = pathIds.get(parentPath);
            if (!parentId) throw new Error("directory_parent_missing");
            const response = await eden.akasha.dir.create_many.post({
                parentId,
                dirs: entries.map((entry) => ({ path: entry.path, name: entry.name })),
            });
            if (response.error) throw new Error(toErrorMessage(response.error.value));
            for (const directory of response.data.directories) {
                pathIds.set(directory.path, directory.uuid);
                result.push({
                    path: directory.path,
                    name: directory.name,
                    parentPath,
                    itemId: directory.uuid,
                });
            }
        }
    }
    return result;
}

async function createModDirectories(
    session: PersistedUploadSession,
    directories: PersistedUploadDirectory[],
) {
    if (directories.every((directory) => directory.itemId)) return directories;
    const response = await eden.akasha.mod.create_dirs.post({
        current: session.current,
        collectionId: session.collectionId!,
        sig: session.sig,
        dirs: directories.map((directory) => ({
            path: directory.path,
            name: directory.name,
            parentPath: directory.parentPath,
        })),
    });
    if (response.error) throw new Error(toErrorMessage(response.error.value));
    if (!Array.isArray(response.data)) throw new Error("create_mod_directories_failed");
    const ids = new Map(
        response.data.map((directory: { path: string; id: string }) => [
            directory.path,
            directory.id,
        ]),
    );
    return directories.map((directory) => ({ ...directory, itemId: ids.get(directory.path) }));
}

async function ensureHashes(snapshot: UploadSessionSnapshot) {
    const unhashed = snapshot.targets.filter((target) => !target.sha256);
    if (unhashed.length === 0) return snapshot;
    await saveUploadSession({
        ...snapshot.session,
        status: "hashing",
        updatedAt: Date.now(),
    });
    const files = await Promise.all(
        unhashed.map(async (target) => {
            const source = await readSourceArtifact(target.requestId, target.clientId);
            if (!source) throw new Error("source_missing");
            return { FID: target.clientId, file: new File([source], target.name) };
        }),
    );
    const hashes = await calculateHashesInParallel(files);
    const targets = snapshot.targets.map((target) => ({
        ...target,
        sha256: target.sha256 || hashes.get(target.clientId),
        status: "planning" as const,
        updatedAt: Date.now(),
    }));
    await saveUploadTargets(targets);
    await refreshSnapshot(snapshot.session.requestId);
    return { ...snapshot, targets };
}

async function ensurePlan(snapshot: UploadSessionSnapshot) {
    const targetsToPlan = snapshot.targets.filter(
        (target) => !isPlanTerminal(target) && !target.intentId,
    );
    if (targetsToPlan.length === 0) return snapshot;
    const session = { ...snapshot.session, status: "planning" as const, updatedAt: Date.now() };
    await saveUploadSession(session);
    const response = await planUploadSession(session, targetsToPlan);
    const applied = applyUploadPlan({
        response,
        targets: targetsToPlan,
    });
    const plannedTargets = new Map(applied.targets.map((target) => [target.clientId, target]));
    const targets = snapshot.targets.map((target) => plannedTargets.get(target.clientId) ?? target);
    const intents = [
        ...new Map(
            [...snapshot.intents, ...applied.intents].map((intent) => [intent.intentId, intent]),
        ).values(),
    ];
    await saveUploadTargets(targets);
    await saveUploadIntents(intents);
    await refreshSnapshot(session.requestId);
    return { session, targets, intents };
}

async function uploadPlannedIntents(snapshot: UploadSessionSnapshot) {
    await saveUploadSession({
        ...snapshot.session,
        status: "uploading",
        updatedAt: Date.now(),
    });
    const limit = pLimit(4);
    await Promise.all(
        snapshot.intents
            .filter((intent) => intent.state !== "completed")
            .map((intent) => limit(() => uploadOneIntent(snapshot, intent))),
    );
}

async function uploadOneIntent(snapshot: UploadSessionSnapshot, original: PersistedUploadIntent) {
    const target = snapshot.targets.find((item) => item.intentId === original.intentId);
    if (!target) return;
    const source = await readSourceArtifact(target.requestId, target.clientId);
    if (!source) throw new Error("source_missing");
    const intent = await prepareIntentArtifact(original, source);
    await saveUploadIntent({ ...intent, state: "uploading", updatedAt: Date.now() });
    await setIntentTargets(snapshot.session.requestId, intent.intentId, "uploading");

    const uploadFile = new File(
        [intent.compAlg ? (await readEncodedArtifact(intent.requestId, intent.intentId))! : source],
        target.name,
    );
    const result = await uploadIntentBytes({
        intent,
        file: uploadFile,
        callbacks: {
            onPartAcknowledged: async (index, totalParts) => {
                const current = await loadRequiredSnapshot(intent.requestId);
                const stored = current.intents.find((item) => item.intentId === intent.intentId);
                if (!stored) return;
                await saveUploadIntent({
                    ...stored,
                    totalParts,
                    acknowledgedParts: [...new Set([...stored.acknowledgedParts, index])],
                    updatedAt: Date.now(),
                });
            },
            onPartsReset: async () => {
                const stored = await getUploadIntent(intent.requestId, intent.intentId);
                if (!stored) return;
                await saveUploadIntent({
                    ...stored,
                    acknowledgedParts: [],
                    updatedAt: Date.now(),
                });
            },
        },
    });
    const stored = await getUploadIntent(intent.requestId, intent.intentId);
    if (!stored) throw new Error("upload_intent_not_found");
    await saveUploadIntent(completeUploadIntentAttempt(stored, result));
    await setIntentTargets(
        snapshot.session.requestId,
        intent.intentId,
        result.status === "completed" ? "completed" : result.status,
        result.reason,
    );
}

async function prepareIntentArtifact(intent: PersistedUploadIntent, source: File) {
    if (intent.compAlg || source.size >= 80 * 1024 * 1024 || (await isPreviewFile(source))) {
        return intent;
    }
    const compressed = await compressData(await source.arrayBuffer(), "zstd");
    if (!compressed.isCompressed || !compressed.compressedData) return intent;
    await writeEncodedArtifact(
        intent.requestId,
        intent.intentId,
        new Blob([new Uint8Array(compressed.compressedData).slice().buffer]),
    );
    const updated = { ...intent, compAlg: "zstd" as const, updatedAt: Date.now() };
    await saveUploadIntent(updated);
    return updated;
}

async function setIntentTargets(
    requestId: string,
    intentId: string,
    status: PersistedUploadTarget["status"],
    reason?: string,
) {
    const snapshot = await loadRequiredSnapshot(requestId);
    await saveUploadTargets(
        snapshot.targets.map((target) =>
            target.intentId === intentId
                ? { ...target, status, reason, updatedAt: Date.now() }
                : target,
        ),
    );
    await refreshSnapshot(requestId);
}

async function finalizeSession(snapshot: UploadSessionSnapshot) {
    const succeeded = snapshot.targets.filter(isSuccessTarget).length;
    const failed = snapshot.targets.length - succeeded;
    const hasRetryable = snapshot.targets.some(
        (target) =>
            target.status === "pending" ||
            target.status === "paused" ||
            target.status === "recovery_required",
    );
    const status = hasRetryable
        ? ("paused" as const)
        : failed > 0
          ? ("partial" as const)
          : ("completed" as const);
    await saveUploadSession({ ...snapshot.session, status, updatedAt: Date.now() });
    if (status === "completed") await deleteUploadSessionArtifacts(snapshot.session.requestId);
    await refreshSnapshot(snapshot.session.requestId);
    await queryClient.invalidateQueries({
        queryKey:
            snapshot.session.kind === "drive"
                ? ["akasha", "drive", "item", snapshot.session.current]
                : ["akasha", "mod", "item", snapshot.session.current],
    });
}

function isSuccessTarget(target: PersistedUploadTarget) {
    return ["created", "exists", "completed"].includes(target.status);
}

function isPlanTerminal(target: PersistedUploadTarget) {
    return isSuccessTarget(target) || target.status === "denied" || target.status === "failed";
}

async function refreshSnapshot(requestId: string) {
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (!snapshot) return;
    uploadSessionStore.getState().upsertSnapshot(snapshot);
    updates?.postMessage({ requestId, type: "updated" });
}

async function loadRequiredSnapshot(requestId: string) {
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (!snapshot) throw new Error("upload_session_not_found");
    return snapshot;
}

async function withUploadLock<T>(requestId: string, run: () => Promise<T>) {
    if (navigator.locks) {
        return navigator.locks.request(
            `akasha-upload:${requestId}`,
            { ifAvailable: true },
            (lock) => (lock ? run() : Promise.resolve(undefined)),
        );
    }
    return run();
}

function toErrorMessage(value: unknown) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) return String(value.message);
    return "upload_request_failed";
}
