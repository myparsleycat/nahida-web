import { countBy } from "es-toolkit";

import type {
    PersistedUploadIntent,
    PersistedUploadTarget,
    UploadPlanResponse,
    UploadSessionSnapshot,
} from "./types";

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

export function hasCompleteDirectoryMapping(snapshot: UploadSessionSnapshot) {
    return (
        snapshot.session.directories.every((directory) => directory.itemId) &&
        snapshot.targets.every((target) => target.parentId)
    );
}

const ACTIVE_UPLOAD_SESSION_STATUSES = [
    "staging",
    "creating_directories",
    "hashing",
    "planning",
    "uploading",
] as const;

export type UploadTargetOutcome = "success" | "excluded" | "failed" | "retryable" | "open";

export function classifyUploadTarget(status: PersistedUploadTarget["status"]): UploadTargetOutcome {
    if (status === "created" || status === "exists" || status === "completed") return "success";
    if (status === "denied") return "excluded";
    if (status === "failed" || status === "cancelled") return "failed";
    if (status === "pending" || status === "paused" || status === "staged") return "retryable";
    return "open";
}

export function summarizeUploadTargets(targets: PersistedUploadTarget[]) {
    const counts = countBy(targets, (target) => classifyUploadTarget(target.status));
    return {
        completed: counts.success ?? 0,
        excluded: counts.excluded ?? 0,
        failed: counts.failed ?? 0,
        retryable: counts.retryable ?? 0,
        open: counts.open ?? 0,
        total: targets.length,
    };
}

export function getUploadByteProgress(
    snapshot: Pick<UploadSessionSnapshot, "session" | "targets">,
    inflightJobs?: Record<string, number>,
) {
    const committedBytes = snapshot.targets.reduce((sum, target) => {
        const outcome = classifyUploadTarget(target.status);
        if (outcome === "success" || outcome === "excluded") return sum + target.size;
        return sum;
    }, 0);
    const inflightBytes = Object.values(inflightJobs ?? {}).reduce((sum, bytes) => sum + bytes, 0);
    const uploadedBytes = snapshot.session.totalBytes
        ? Math.min(committedBytes + inflightBytes, snapshot.session.totalBytes)
        : committedBytes + inflightBytes;
    return {
        committedBytes,
        inflightBytes,
        uploadedBytes,
        percent: snapshot.session.totalBytes
            ? (uploadedBytes / snapshot.session.totalBytes) * 100
            : snapshot.session.status === "completed"
              ? 100
              : 0,
    };
}

export function getFinalUploadSessionStatus(targets: PersistedUploadTarget[]) {
    const summary = summarizeUploadTargets(targets);
    if (summary.retryable > 0) return "paused";
    if (summary.failed > 0 || summary.open > 0) return "partial";
    return "completed";
}

export function isPlanTerminal(target: PersistedUploadTarget) {
    const outcome = classifyUploadTarget(target.status);
    return outcome === "success" || outcome === "excluded" || outcome === "failed";
}

export function getUploadSessionActionAvailability(snapshot: UploadSessionSnapshot) {
    const status = snapshot.session.status;
    const isActive = (ACTIVE_UPLOAD_SESSION_STATUSES as readonly string[]).includes(status);
    const hasRetryableTargets = snapshot.targets.some(
        (target) =>
            ["pending", "paused", "staged"].includes(target.status) ||
            (target.status === "failed" && !isNonRetryableUploadReason(target.reason)),
    );

    return {
        // pending targets are normal during an active upload — only offer retry once the
        // session has stopped in a recovery state (failed / paused / partial).
        canRetry:
            !isActive &&
            (hasRetryableTargets ||
                (status === "failed" &&
                    !isNonRetryableUploadReason(
                        snapshot.session.errorCode ?? snapshot.session.reason,
                    ))),
        canCancel: isActive || status === "failed" || status === "paused",
        canDismiss: ["completed", "partial", "cancelled"].includes(status),
    };
}

export function prepareUploadRetry(snapshot: UploadSessionSnapshot, now = Date.now()) {
    const retryableBundleIds = new Set(
        snapshot.targets.flatMap((target) =>
            target.bundleId &&
            target.status === "failed" &&
            !isNonRetryableUploadReason(target.reason)
                ? [target.bundleId]
                : [],
        ),
    );
    const shouldRetry = (target: PersistedUploadTarget) =>
        (target.status === "failed" && !isNonRetryableUploadReason(target.reason)) ||
        (target.bundleId ? retryableBundleIds.has(target.bundleId) : false);
    const staleIntentIds = [
        ...new Set(
            snapshot.targets.flatMap((target) =>
                shouldRetry(target) && target.intentId ? [target.intentId] : [],
            ),
        ),
    ];
    const staleIntentIdSet = new Set(staleIntentIds);

    return {
        staleIntentIds,
        intents: snapshot.intents.filter((intent) => !staleIntentIdSet.has(intent.intentId)),
        targets: snapshot.targets.map((target) => {
            if (!shouldRetry(target)) return target;
            const retryTarget = {
                ...target,
                status: "planning" as const,
                updatedAt: now,
            };
            delete retryTarget.reason;
            delete retryTarget.intentId;
            delete retryTarget.itemId;
            return retryTarget;
        }),
        nteBundles: snapshot.session.nteBundles?.map((bundle) =>
            retryableBundleIds.has(bundle.id)
                ? { ...bundle, state: "pending" as const, reason: undefined, updatedAt: now }
                : bundle,
        ),
    };
}

export function prepareUploadCancellation(snapshot: UploadSessionSnapshot, now = Date.now()) {
    const preservedTargetStatuses: PersistedUploadTarget["status"][] = [
        "created",
        "exists",
        "completed",
        "denied",
        "failed",
    ];

    return {
        session: {
            ...snapshot.session,
            status: "cancelled" as const,
            reason: "page_unloaded",
            nteBundles: snapshot.session.nteBundles?.map((bundle) =>
                bundle.state === "completed"
                    ? bundle
                    : { ...bundle, state: "cancelled" as const, updatedAt: now },
            ),
            updatedAt: now,
        },
        targets: snapshot.targets.map((target) =>
            preservedTargetStatuses.includes(target.status)
                ? target
                : {
                      ...target,
                      status: "cancelled" as const,
                      reason: "page_unloaded",
                      updatedAt: now,
                  },
        ),
        intents: snapshot.intents.map((intent) =>
            intent.state === "completed"
                ? intent
                : {
                      ...intent,
                      state: "cancelled" as const,
                      updatedAt: now,
                  },
        ),
    };
}

export function completeUploadIntentAttempt(
    intent: PersistedUploadIntent,
    result: { status: "completed" | "paused" | "failed" },
    now = Date.now(),
) {
    return {
        ...intent,
        state: result.status,
        attemptCount: intent.attemptCount + 1,
        updatedAt: now,
    };
}

export function getIntentTargetUpdates(
    targets: PersistedUploadTarget[],
    intentId: string,
    status: PersistedUploadTarget["status"],
    reason?: string,
    now = Date.now(),
) {
    return targets
        .filter((target) => target.intentId === intentId)
        .map((target) => ({ ...target, status, reason, updatedAt: now }));
}

export function applyUploadPlan({
    response,
    targets,
    intents = [],
    now = Date.now(),
}: {
    response: UploadPlanResponse;
    targets: PersistedUploadTarget[];
    intents?: PersistedUploadIntent[];
    now?: number;
}) {
    if (targets.some((target) => target.requestId !== response.requestId)) {
        throw new Error("upload_plan_request_mismatch");
    }

    const planItems = new Map<string, UploadPlanResponse["items"][number]>();
    for (const item of response.items) {
        if (planItems.has(item.clientId)) throw new Error("duplicate_upload_plan_client_id");
        planItems.set(item.clientId, item);
    }

    const bundles = new Map((response.nteBundles ?? []).map((bundle) => [bundle.id, bundle]));
    const uploadedIntentIds = new Set(response.uploads.map((upload) => upload.intentId));
    const updatedTargets = targets.map((target) => {
        const item = planItems.get(target.clientId);
        if (!item) {
            return {
                ...target,
                status: "failed" as const,
                reason: "plan_result_missing",
                updatedAt: now,
            };
        }

        if (item.status === "pending" && !item.intentId) {
            return {
                ...target,
                status: "failed" as const,
                reason: "invalid_plan_response",
                updatedAt: now,
            };
        }

        if (
            item.bundleId &&
            (!bundles.get(item.bundleId)?.memberClientIds.includes(item.clientId) ||
                item.status === "denied" ||
                item.status === "error")
        ) {
            return {
                ...target,
                status: "failed" as const,
                reason: item.reason ?? "invalid_plan_response",
                bundleId: item.bundleId,
                updatedAt: now,
            };
        }

        const status =
            item.bundleId &&
            (item.status === "created" ||
                item.status === "exists" ||
                (item.status === "pending" &&
                    item.intentId &&
                    !uploadedIntentIds.has(item.intentId)))
                ? ("staged" as const)
                : item.status === "denied" && isNonRetryableUploadReason(item.reason)
                  ? ("failed" as const)
                  : item.status === "error"
                    ? ("failed" as const)
                    : item.status;

        return {
            ...target,
            status,
            reason: item.reason,
            itemId: item.itemId,
            intentId: item.intentId,
            bundleId: item.bundleId,
            updatedAt: now,
        };
    });

    const referencedIntentIds = new Set(
        updatedTargets
            .filter((target) => target.status === "pending" && target.intentId)
            .map((target) => target.intentId!),
    );
    const existingIntents = new Map(intents.map((intent) => [intent.intentId, intent]));
    const seenIntentIds = new Set<string>();
    const uploadIntents = response.uploads.flatMap((upload) => {
        if (seenIntentIds.has(upload.intentId)) throw new Error("duplicate_upload_plan_intent_id");
        seenIntentIds.add(upload.intentId);
        if (!referencedIntentIds.has(upload.intentId)) return [];

        const existing = existingIntents.get(upload.intentId);
        return [
            {
                requestId: response.requestId,
                intentId: upload.intentId,
                url: upload.url,
                token: upload.form.token,
                sha256: upload.form.sha256,
                state: existing?.state ?? ("pending" as const),
                totalParts: existing?.totalParts,
                acknowledgedParts: existing?.acknowledgedParts ?? [],
                attemptCount: existing?.attemptCount ?? 0,
                nextRetryAt: existing?.nextRetryAt,
                compAlg: existing?.compAlg,
                reverse: existing?.reverse,
                updatedAt: now,
            },
        ];
    });

    return {
        targets: updatedTargets,
        intents: uploadIntents,
        nteBundles: [...bundles.values()].map((bundle) => ({
            id: bundle.id,
            memberClientIds: bundle.memberClientIds,
            completeUrl: bundle.completeUrl,
            abortUrl: bundle.abortUrl,
            token: bundle.form.token,
            state: "pending" as const,
            updatedAt: now,
        })),
    };
}

export function isNonRetryableUploadReason(reason?: string) {
    return (
        reason === "invalid_nte_mod_file" ||
        reason === "nte_client_upgrade_required" ||
        reason === "nte_bundle_too_large" ||
        reason === "file_too_large"
    );
}

export function getUploadRetryDecision({
    attemptCount,
    responseStatus,
    networkError = false,
    pending = false,
    retryAfterMs,
    now = Date.now(),
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
}: {
    attemptCount: number;
    responseStatus?: number;
    networkError?: boolean;
    pending?: boolean;
    retryAfterMs?: number;
    now?: number;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}) {
    if (!Number.isInteger(attemptCount) || attemptCount < 1) {
        throw new Error("invalid_upload_attempt_count");
    }

    const retryableStatus =
        responseStatus === 408 ||
        responseStatus === 425 ||
        responseStatus === 429 ||
        (responseStatus !== undefined && responseStatus >= 500 && responseStatus < 600);
    if (!pending && !networkError && !retryableStatus) {
        return { retry: false as const, reason: "non_retryable_failure" as const };
    }
    if (attemptCount >= maxRetries) {
        return { retry: false as const, reason: "retry_limit_reached" as const };
    }

    const backoffMs = Math.min(baseDelayMs * 2 ** (attemptCount - 1), maxDelayMs);
    const delayMs = Math.max(backoffMs, retryAfterMs ?? 0);
    return {
        retry: true as const,
        reason: pending ? ("pending" as const) : ("retryable_failure" as const),
        delayMs,
        nextRetryAt: now + delayMs,
    };
}

export function createChunkIndexes(totalParts: number) {
    if (!Number.isInteger(totalParts) || totalParts <= 0) {
        throw new Error("invalid_total_parts");
    }
    return Array.from({ length: totalParts }, (_, index) => index);
}
