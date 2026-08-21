import { groupBy, orderBy, throttle } from "es-toolkit";
import pLimit from "p-limit";

import type { DirectoryInfo, FileInfoComponent } from "@/lib/workers/akasha.worker";

import { queryClient } from "@/integrations/queryClient";
import { eden } from "@/lib/eden";
import { cleanupUploadOpfsArtifacts } from "@/lib/opfs";
import { calculateHashesInParallel } from "@/lib/workers/upload/hash-pool";
import {
    registerUploadSessionActions,
    uploadSessionStore,
} from "@/stores/akasha-upload-session.store";

import type {
    PersistedUploadDirectory,
    PersistedUploadIntent,
    PersistedNteBundle,
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadKind,
    UploadSessionSnapshot,
    UploadSessionStatus,
} from "./types";

import { prepareUploadFile } from "./compress";
import {
    DIRECT_UPLOAD_THRESHOLD,
    PACK_MAX_FILES,
    PACK_PAYLOAD_BUDGET,
    partitionPackedUploads,
} from "./pack";
import { planUploadSession } from "./planner";
import {
    applyUploadPlan,
    completeUploadIntentAttempt,
    getFinalUploadSessionStatus,
    getIntentTargetUpdates,
    hasCompleteDirectoryMapping,
    isPlanTerminal,
    prepareUploadCancellation,
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
import {
    abortNteBundle,
    completeNteBundle,
    uploadIntentBytes,
    uploadPackBytes,
    type PackMemberInput,
} from "./transport";

const LEASE_MS = 60_000;
const TAB_ID_KEY = "akasha-upload-tab-id";
const tabId = getUploadTabId();
const sourceFiles = new Map<string, Map<string, File>>();
const encodedFiles = new Map<string, File>();
const activeUploadControllers = new Map<string, AbortController>();
const updates =
    typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel("akasha-upload-sessions");

if (updates) updates.onmessage = () => void hydrateUploadSessions();
if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
        activeUploadControllers.forEach((controller) => controller.abort("page_unloaded"));
        [...sourceFiles.keys()].forEach((requestId) => {
            void loadUploadSessionSnapshot(requestId).then((snapshot) => {
                if (snapshot) return cancelPersistedUploadSession(snapshot);
            });
        });
    });
}

registerUploadSessionActions({
    retry: retryUploadSession,
    dismiss: dismissUploadSession,
});

export async function startUploadSession({
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
    sourceFiles.set(requestId, new Map(files.map((file) => [file.clientId, file.file])));

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
        updatedAt: now,
    }));

    await Promise.all([saveUploadSession(session), saveUploadTargets(targets)]).catch((error) => {
        clearUploadMemory(requestId);
        throw error;
    });
    await refreshSnapshot(requestId);

    await runUploadSession(requestId);
    return requestId;
}

export async function hydrateUploadSessions() {
    const snapshots = await listIncompleteUploadSessionSnapshots();
    uploadSessionStore.getState().replaceSnapshots(snapshots);
    uploadSessionStore.getState().setHydrated(true);
    return snapshots;
}

export async function initializeUploadSessions() {
    await cleanupUploadOpfsArtifacts();
    const snapshots = await listIncompleteUploadSessionSnapshots();
    for (const snapshot of orderBy(snapshots, [(item) => item.session.createdAt], ["asc"])) {
        if (snapshot.session.status === "cancelled") continue;
        if (
            snapshot.session.leaseOwner &&
            snapshot.session.leaseOwner !== tabId &&
            (snapshot.session.leaseUntil ?? 0) > Date.now()
        ) {
            continue;
        }
        await cancelPersistedUploadSession(snapshot);
    }
    return hydrateUploadSessions();
}

export async function retryUploadSession(requestId: string) {
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (!snapshot) return;
    if (!sourceFiles.has(requestId)) {
        await cancelPersistedUploadSession(snapshot);
        return;
    }
    const retry = prepareUploadRetry(snapshot);
    await Promise.all(
        retry.staleIntentIds.map((intentId) => deleteUploadIntent(requestId, intentId)),
    );
    retry.staleIntentIds.forEach((intentId) =>
        encodedFiles.delete(encodedFileKey(requestId, intentId)),
    );
    await saveUploadTargets(retry.targets);
    await saveUploadSession({
        ...snapshot.session,
        status: "paused",
        nteBundles: retry.nteBundles,
        reason: undefined,
        errorCode: undefined,
        updatedAt: Date.now(),
    });
    await runUploadSession(requestId);
}

export async function dismissUploadSession(requestId: string) {
    activeUploadControllers.get(requestId)?.abort("upload_cancelled");
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (snapshot) await abortPersistedBundles(snapshot);
    clearUploadMemory(requestId);
    await deleteUploadSession(requestId);
    uploadSessionStore.getState().removeSnapshot(requestId);
    updates?.postMessage({ requestId, type: "deleted" });
}

async function runUploadSession(requestId: string) {
    return withUploadLock(requestId, async () => {
        const leased = await acquireUploadSessionLease({
            requestId,
            owner: tabId,
            ttlMs: LEASE_MS,
        });
        if (!leased) return;
        const controller = new AbortController();
        activeUploadControllers.set(requestId, controller);
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
            snapshot = await ensureDirectories(snapshot);
            snapshot = await ensureHashes(snapshot, controller.signal);
            snapshot = await ensurePlan(snapshot);
            controller.signal.throwIfAborted();
            await uploadPlannedIntents(snapshot, controller.signal);
            controller.signal.throwIfAborted();
            await finalizeNteBundles(await loadRequiredSnapshot(requestId), controller.signal);
            controller.signal.throwIfAborted();
            await finalizeSession(await loadRequiredSnapshot(requestId));
        } catch (error) {
            // dismiss already deletes the session after aborting; do not re-persist a cancelled row.
            if (controller.signal.aborted && controller.signal.reason === "upload_cancelled") {
                return;
            }
            const snapshot = await loadUploadSessionSnapshot(requestId);
            if (snapshot) {
                if (controller.signal.aborted) {
                    await cancelPersistedUploadSession(snapshot);
                    return;
                }
                await saveUploadSession({
                    ...snapshot.session,
                    status: "failed",
                    reason: error instanceof Error ? error.message : "upload_failed",
                    errorCode: toErrorCode(error),
                    updatedAt: Date.now(),
                });
                await refreshSnapshot(requestId);
            }
        } finally {
            window.clearInterval(leaseTimer);
            if (activeUploadControllers.get(requestId) === controller) {
                activeUploadControllers.delete(requestId);
            }
            await releaseUploadSessionLease(requestId, tabId).catch(() => false);
        }
    });
}

async function ensureDirectories(snapshot: UploadSessionSnapshot): Promise<UploadSessionSnapshot> {
    if (hasCompleteDirectoryMapping(snapshot)) return snapshot;
    const session = await setSessionStatus(snapshot.session, "creating_directories");
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
    const nextSession = { ...session, directories, updatedAt: Date.now() };
    await saveUploadSession(nextSession);
    await saveUploadTargets(targets);
    await refreshSnapshot(session.requestId);
    return { ...snapshot, session: nextSession, targets };
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

async function ensureHashes(snapshot: UploadSessionSnapshot, signal: AbortSignal) {
    const unhashed = snapshot.targets.filter((target) => !target.sha256);
    if (unhashed.length === 0) return snapshot;
    const session = await setSessionStatus(snapshot.session, "hashing");
    const files = await Promise.all(
        unhashed.map(async (target) => {
            const source = sourceFiles.get(target.requestId)?.get(target.clientId);
            if (!source) throw new Error("source_missing");
            return { FID: target.clientId, file: source };
        }),
    );
    const hashes = await calculateHashesInParallel(files, undefined, signal);
    const targets = snapshot.targets.map((target) => ({
        ...target,
        sha256: target.sha256 || hashes.get(target.clientId),
        status: "planning" as const,
        updatedAt: Date.now(),
    }));
    await saveUploadTargets(targets);
    await refreshSnapshot(session.requestId);
    return { ...snapshot, session, targets };
}

async function ensurePlan(snapshot: UploadSessionSnapshot) {
    const targetsToPlan = snapshot.targets.filter(
        (target) => !isPlanTerminal(target) && !target.intentId,
    );
    if (targetsToPlan.length === 0) return snapshot;
    const session = await setSessionStatus(snapshot.session, "planning");
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
    const nextSession = {
        ...session,
        nteBundles: [
            ...new Map(
                [...(session.nteBundles ?? []), ...applied.nteBundles].map((bundle) => [
                    bundle.id,
                    bundle,
                ]),
            ).values(),
        ],
        updatedAt: Date.now(),
    };
    await saveUploadSession(nextSession);
    await saveUploadTargets(targets);
    await saveUploadIntents(intents);
    await refreshSnapshot(session.requestId);
    return { ...snapshot, session: nextSession, targets, intents };
}

async function uploadPlannedIntents(snapshot: UploadSessionSnapshot, signal: AbortSignal) {
    const session = await setSessionStatus(snapshot.session, "uploading");
    snapshot = { ...snapshot, session };
    const directLimit = pLimit(8);
    const multipartLimit = pLimit(4);
    const bundleControllers = new Map<string, AbortController>();
    const jobs: Array<Promise<void>> = [];
    const packed: PackMemberInput[] = [];
    const flushPacked = () => {
        const groups = partitionPackedUploads(packed.splice(0));
        for (const group of groups) {
            if (group.kind === "single") {
                jobs.push(
                    directLimit(() =>
                        uploadOneIntent(snapshot, group.member.intent, signal)
                            .then(() => undefined)
                            .catch((error: unknown) =>
                                failUploadIntent(snapshot, group.member.intent, error),
                            ),
                    ),
                );
                continue;
            }
            jobs.push(
                directLimit(() =>
                    uploadPackedIntents(snapshot, group.members, signal).catch(
                        async (error: unknown) => {
                            if (error instanceof DOMException && error.name === "AbortError") {
                                return;
                            }
                            await Promise.all(
                                group.members.map((member) =>
                                    failUploadIntent(snapshot, member.intent, error),
                                ),
                            );
                        },
                    ),
                ),
            );
        }
    };

    for (const intent of snapshot.intents.filter((item) => item.state !== "completed")) {
        const target = snapshot.targets.find((item) => item.intentId === intent.intentId);
        if (!target) continue;
        const source = sourceFiles.get(target.requestId)?.get(target.clientId);
        if (!source) {
            jobs.push(
                directLimit(() => failUploadIntent(snapshot, intent, new Error("source_missing"))),
            );
            continue;
        }
        if (target.bundleId) {
            const bundleController =
                bundleControllers.get(target.bundleId) ?? new AbortController();
            bundleControllers.set(target.bundleId, bundleController);
            const bundleSignal = AbortSignal.any([signal, bundleController.signal]);
            jobs.push(
                (source.size >= DIRECT_UPLOAD_THRESHOLD ? multipartLimit : directLimit)(() =>
                    uploadOneIntent(snapshot, intent, bundleSignal)
                        .then((result) => {
                            if (result.status === "failed") {
                                bundleController.abort(result.reason ?? "upload_failed");
                            }
                        })
                        .catch(async (error: unknown) => {
                            if (signal.aborted) return;
                            if (!bundleController.signal.aborted) {
                                bundleController.abort(
                                    error instanceof Error ? error.message : "upload_failed",
                                );
                                await failUploadIntent(snapshot, intent, error);
                                return;
                            }
                            await failUploadIntent(
                                snapshot,
                                intent,
                                new Error("nte_bundle_incomplete"),
                            );
                        }),
                ),
            );
            continue;
        }
        if (source.size >= DIRECT_UPLOAD_THRESHOLD) {
            jobs.push(
                multipartLimit(() =>
                    uploadOneIntent(snapshot, intent, signal)
                        .then(() => undefined)
                        .catch((error: unknown) => failUploadIntent(snapshot, intent, error)),
                ),
            );
            continue;
        }
        try {
            const prepared = await prepareIntentFile(intent, source);
            packed.push({
                intent: prepared.intent,
                file: prepared.file,
                logicalSize: source.size,
                payloadBytes: prepared.file.size,
            });
        } catch (error) {
            jobs.push(directLimit(() => failUploadIntent(snapshot, intent, error)));
            continue;
        }
        const packedBytes = packed.reduce((sum, member) => sum + member.payloadBytes, 0);
        if (packed.length >= PACK_MAX_FILES || packedBytes >= PACK_PAYLOAD_BUDGET) flushPacked();
    }
    flushPacked();
    await Promise.all(jobs);
}

async function uploadPackedIntents(
    snapshot: UploadSessionSnapshot,
    members: PackMemberInput[],
    signal: AbortSignal,
) {
    const inflight = trackInflightBytes(
        snapshot.session.requestId,
        members.map((member) => member.intent.intentId).join(","),
    );
    try {
        await Promise.all(
            members.map(async (member) => {
                await saveUploadIntent({
                    ...member.intent,
                    state: "uploading",
                    updatedAt: Date.now(),
                });
                await setIntentTargets(
                    snapshot.session.requestId,
                    member.intent.intentId,
                    "uploading",
                );
            }),
        );
        const results = await uploadPackBytes({
            members,
            signal,
            callbacks: { onProgress: (uploadedBytes) => inflight.report(uploadedBytes) },
        });
        await Promise.all(
            members.map(async (member, index) => {
                const result = results[index] ?? {
                    status: "failed" as const,
                    reason: "pack_result_missing",
                };
                const stored = await getUploadIntent(
                    member.intent.requestId,
                    member.intent.intentId,
                );
                if (!stored) throw new Error("upload_intent_not_found");
                await saveUploadIntent(completeUploadIntentAttempt(stored, result));
                await setIntentTargets(
                    snapshot.session.requestId,
                    member.intent.intentId,
                    result.status === "completed" ? "completed" : result.status,
                    result.reason,
                );
                if (result.status === "completed") {
                    releaseIntentFiles(snapshot, member.intent.intentId);
                }
            }),
        );
    } finally {
        inflight.finish();
    }
}

async function uploadOneIntent(
    snapshot: UploadSessionSnapshot,
    original: PersistedUploadIntent,
    signal: AbortSignal,
) {
    const target = snapshot.targets.find((item) => item.intentId === original.intentId);
    if (!target) throw new Error("upload_target_not_found");
    const source = sourceFiles.get(target.requestId)?.get(target.clientId);
    if (!source) throw new Error("source_missing");
    const prepared = await prepareIntentFile(original, source);
    const inflight = trackInflightBytes(snapshot.session.requestId, original.intentId);
    try {
        await saveUploadIntent({ ...prepared.intent, state: "uploading", updatedAt: Date.now() });
        await setIntentTargets(snapshot.session.requestId, prepared.intent.intentId, "uploading");
        const result = await uploadIntentBytes({
            intent: prepared.intent,
            file: prepared.file,
            signal,
            callbacks: {
                onProgress: (uploaded, payloadTotal) => {
                    inflight.report(
                        payloadTotal > 0
                            ? Math.min(
                                  source.size,
                                  Math.floor((source.size * uploaded) / payloadTotal),
                              )
                            : 0,
                    );
                },
                onPartAcknowledged: async (index, totalParts) => {
                    const current = await loadRequiredSnapshot(prepared.intent.requestId);
                    const stored = current.intents.find(
                        (item) => item.intentId === prepared.intent.intentId,
                    );
                    if (!stored) return;
                    await saveUploadIntent({
                        ...stored,
                        totalParts,
                        acknowledgedParts: [...new Set([...stored.acknowledgedParts, index])],
                        updatedAt: Date.now(),
                    });
                },
                onPartsReset: async () => {
                    const stored = await getUploadIntent(
                        prepared.intent.requestId,
                        prepared.intent.intentId,
                    );
                    if (!stored) return;
                    await saveUploadIntent({
                        ...stored,
                        acknowledgedParts: [],
                        updatedAt: Date.now(),
                    });
                },
            },
        });
        const stored = await getUploadIntent(prepared.intent.requestId, prepared.intent.intentId);
        if (!stored) throw new Error("upload_intent_not_found");
        await saveUploadIntent(completeUploadIntentAttempt(stored, result));
        await setIntentTargets(
            snapshot.session.requestId,
            prepared.intent.intentId,
            result.status === "completed"
                ? target.bundleId
                    ? "staged"
                    : "completed"
                : result.status,
            result.reason,
        );
        if (result.status === "completed" && !target.bundleId) {
            releaseIntentFiles(snapshot, prepared.intent.intentId);
        }
        return result;
    } finally {
        inflight.finish();
    }
}

async function prepareIntentFile(intent: PersistedUploadIntent, source: File) {
    const cached = encodedFiles.get(encodedFileKey(intent.requestId, intent.intentId));
    if (cached) return { intent, file: cached };
    const prepared = await prepareUploadFile(source);
    if (!prepared.compAlg) return { intent, file: prepared.file };
    encodedFiles.set(encodedFileKey(intent.requestId, intent.intentId), prepared.file);
    const updated = { ...intent, compAlg: prepared.compAlg, updatedAt: Date.now() };
    await saveUploadIntent(updated);
    return { intent: updated, file: prepared.file };
}

async function failUploadIntent(
    snapshot: UploadSessionSnapshot,
    intent: PersistedUploadIntent,
    error: unknown,
) {
    const stored = await getUploadIntent(intent.requestId, intent.intentId);
    if (stored) {
        await saveUploadIntent(completeUploadIntentAttempt(stored, { status: "failed" }));
    }
    await setIntentTargets(
        snapshot.session.requestId,
        intent.intentId,
        "failed",
        error instanceof Error ? error.message : "upload_failed",
    );
}

async function setIntentTargets(
    requestId: string,
    intentId: string,
    status: PersistedUploadTarget["status"],
    reason?: string,
) {
    const snapshot = await loadRequiredSnapshot(requestId);
    await saveUploadTargets(getIntentTargetUpdates(snapshot.targets, intentId, status, reason));
    await refreshSnapshot(requestId);
}

async function finalizeNteBundles(snapshot: UploadSessionSnapshot, signal: AbortSignal) {
    for (const bundle of snapshot.session.nteBundles ?? []) {
        if (["completed", "cancelled"].includes(bundle.state)) continue;
        signal.throwIfAborted();
        const current = await loadRequiredSnapshot(snapshot.session.requestId);
        const stored = current.session.nteBundles?.find((item) => item.id === bundle.id);
        if (!stored) continue;
        const members = current.targets.filter((target) => target.bundleId === stored.id);
        const failedReasons = members
            .filter((target) => target.status === "failed")
            .map((target) => target.reason)
            .filter((reason): reason is string => Boolean(reason));
        const reason =
            failedReasons.find(
                (failed) => failed !== "nte_bundle_incomplete" && failed !== "Aborted",
            ) ??
            failedReasons[0] ??
            (members.length === stored.memberClientIds.length
                ? undefined
                : "invalid_plan_response");
        if (reason) {
            await failNteBundle(current, stored, reason);
            continue;
        }
        if (members.some((target) => target.status !== "staged")) continue;

        await saveUploadTargets(
            members.map((target) => ({
                ...target,
                status: "completing" as const,
                updatedAt: Date.now(),
            })),
        );
        await setNteBundleState(current.session, stored.id, "completing");
        await refreshSnapshot(current.session.requestId);
        const result = await completeNteBundle(stored, signal);
        if (result.status === "completed") {
            await saveUploadTargets(
                members.map((target) => ({
                    ...target,
                    status: "completed" as const,
                    reason: undefined,
                    updatedAt: Date.now(),
                })),
            );
            await setNteBundleState(current.session, stored.id, "completed");
            releaseBundleFiles(current, stored.id);
            await refreshSnapshot(current.session.requestId);
            continue;
        }
        if (result.status === "failed") {
            await failNteBundle(current, stored, result.reason ?? "invalid_nte_mod_file");
            continue;
        }
        await saveUploadTargets(
            members.map((target) => ({
                ...target,
                status: "staged" as const,
                reason: result.reason,
                updatedAt: Date.now(),
            })),
        );
        await setNteBundleState(current.session, stored.id, "paused", result.reason);
        await refreshSnapshot(current.session.requestId);
    }
}

async function failNteBundle(
    snapshot: UploadSessionSnapshot,
    bundle: PersistedNteBundle,
    reason: string,
) {
    const cleanupFailed = await abortNteBundle(bundle).then(
        () => false,
        () => true,
    );
    const members = snapshot.targets.filter((target) => target.bundleId === bundle.id);
    await saveUploadTargets(
        members.map((target) => ({
            ...target,
            status: "failed" as const,
            reason,
            updatedAt: Date.now(),
        })),
    );
    await setNteBundleState(snapshot.session, bundle.id, "failed", reason, {
        errorCode: cleanupFailed ? "bundle_cleanup_failed" : reason,
        reason: cleanupFailed ? "bundle_cleanup_failed" : reason,
    });
    releaseBundleFiles(snapshot, bundle.id);
    await refreshSnapshot(snapshot.session.requestId);
}

async function setNteBundleState(
    session: PersistedUploadSession,
    bundleId: string,
    state: PersistedNteBundle["state"],
    reason?: string,
    sessionError?: Pick<PersistedUploadSession, "errorCode" | "reason">,
) {
    const current = (await loadUploadSessionSnapshot(session.requestId))?.session ?? session;
    await saveUploadSession({
        ...current,
        ...sessionError,
        nteBundles: current.nteBundles?.map((bundle) =>
            bundle.id === bundleId ? { ...bundle, state, reason, updatedAt: Date.now() } : bundle,
        ),
        updatedAt: Date.now(),
    });
}

async function abortPersistedBundles(snapshot: UploadSessionSnapshot) {
    const bundles = (snapshot.session.nteBundles ?? []).filter(
        (bundle) => !["completed", "cancelled"].includes(bundle.state),
    );
    if (bundles.length === 0) return false;
    return (await Promise.allSettled(bundles.map((bundle) => abortNteBundle(bundle)))).some(
        (result) => result.status === "rejected",
    );
}

async function finalizeSession(snapshot: UploadSessionSnapshot) {
    const status = getFinalUploadSessionStatus(snapshot.targets);
    const terminalError = snapshot.targets.find(
        (target) => target.status === "failed" && target.reason,
    )?.reason;
    await saveUploadSession({
        ...snapshot.session,
        status,
        reason: terminalError ?? snapshot.session.reason,
        errorCode: terminalError ?? snapshot.session.errorCode,
        updatedAt: Date.now(),
    });
    if (status === "completed") clearUploadMemory(snapshot.session.requestId);
    await refreshSnapshot(snapshot.session.requestId);
    await queryClient.invalidateQueries({
        queryKey:
            snapshot.session.kind === "drive"
                ? ["akasha", "drive", "item", snapshot.session.current]
                : ["akasha", "mod", "item", snapshot.session.current],
    });
}

async function cancelPersistedUploadSession(snapshot: UploadSessionSnapshot) {
    const cleanupFailed = await abortPersistedBundles(snapshot);
    const cancelled = prepareUploadCancellation(snapshot);
    await Promise.all([
        saveUploadSession({
            ...cancelled.session,
            errorCode: cleanupFailed ? "bundle_cleanup_failed" : cancelled.session.errorCode,
            reason: cleanupFailed ? "bundle_cleanup_failed" : cancelled.session.reason,
        }),
        saveUploadTargets(cancelled.targets),
        saveUploadIntents(cancelled.intents),
    ]);
    clearUploadMemory(snapshot.session.requestId);
    await refreshSnapshot(snapshot.session.requestId);
}

function releaseIntentFiles(snapshot: UploadSessionSnapshot, intentId: string) {
    const sources = sourceFiles.get(snapshot.session.requestId);
    snapshot.targets
        .filter((target) => target.intentId === intentId)
        .forEach((target) => sources?.delete(target.clientId));
    encodedFiles.delete(encodedFileKey(snapshot.session.requestId, intentId));
}

function releaseBundleFiles(snapshot: UploadSessionSnapshot, bundleId: string) {
    const sources = sourceFiles.get(snapshot.session.requestId);
    snapshot.targets
        .filter((target) => target.bundleId === bundleId)
        .forEach((target) => {
            sources?.delete(target.clientId);
            if (target.intentId) {
                encodedFiles.delete(encodedFileKey(snapshot.session.requestId, target.intentId));
            }
        });
}

function trackInflightBytes(requestId: string, jobKey: string) {
    const report = throttle((bytes: number) => {
        uploadSessionStore.getState().setInflightBytes(requestId, jobKey, bytes);
    }, 100);
    return {
        report,
        finish() {
            report.cancel();
            uploadSessionStore.getState().clearInflightJob(requestId, jobKey);
        },
    };
}

function clearUploadMemory(requestId: string) {
    sourceFiles.delete(requestId);
    [...encodedFiles.keys()]
        .filter((key) => key.startsWith(`${requestId}:`))
        .forEach((key) => encodedFiles.delete(key));
    uploadSessionStore.getState().clearInflightRequest(requestId);
}

function encodedFileKey(requestId: string, intentId: string) {
    return `${requestId}:${intentId}`;
}

function getUploadTabId() {
    if (typeof sessionStorage === "undefined") return crypto.randomUUID();
    const stored = sessionStorage.getItem(TAB_ID_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, created);
    return created;
}

async function setSessionStatus(session: PersistedUploadSession, status: UploadSessionStatus) {
    const next = { ...session, status, updatedAt: Date.now() };
    await saveUploadSession(next);
    await refreshSnapshot(next.requestId);
    return next;
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

function toErrorCode(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    return "upload_failed";
}
