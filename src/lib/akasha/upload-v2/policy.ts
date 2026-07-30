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

export function getUploadSessionActionAvailability(snapshot: UploadSessionSnapshot) {
    return {
        canRetry:
            snapshot.session.status === "failed" ||
            snapshot.targets.some((target) =>
                ["pending", "paused", "failed"].includes(target.status),
            ),
        canCancel:
            snapshot.session.status === "failed" ||
            snapshot.session.status === "paused" ||
            snapshot.targets.some((target) => target.status === "recovery_required"),
        canDismiss: ["completed", "partial"].includes(snapshot.session.status),
    };
}

export function prepareUploadRetry(snapshot: UploadSessionSnapshot, now = Date.now()) {
    const staleIntentIds = [
        ...new Set(
            snapshot.targets.flatMap((target) =>
                target.status === "failed" && target.intentId ? [target.intentId] : [],
            ),
        ),
    ];
    const staleIntentIdSet = new Set(staleIntentIds);

    return {
        staleIntentIds,
        intents: snapshot.intents.filter((intent) => !staleIntentIdSet.has(intent.intentId)),
        targets: snapshot.targets.map((target) => {
            if (target.status !== "failed") return target;
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

        return {
            ...target,
            status: item.status === "error" ? ("failed" as const) : item.status,
            reason: item.reason,
            itemId: item.itemId,
            intentId: item.intentId,
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

    return { targets: updatedTargets, intents: uploadIntents };
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
