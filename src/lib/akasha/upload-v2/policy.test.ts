import { describe, expect, it } from "vitest";

import type {
    PersistedUploadIntent,
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadPlanResponse,
    UploadSessionSnapshot,
} from "./types";

import {
    applyUploadPlan,
    completeUploadIntentAttempt,
    createChunkIndexes,
    getFinalUploadSessionStatus,
    getUploadByteProgress,
    getUploadRetryDecision,
    getUploadSessionActionAvailability,
    getIntentTargetUpdates,
    hasCompleteDirectoryMapping,
    isPlanTerminal,
    prepareUploadCancellation,
    prepareUploadRetry,
    summarizeUploadTargets,
} from "./policy";

const REQUEST_ID = "9db50716-3f2f-44c7-afc1-bf12957943f5";
const NOW = 1_000_000;

function target(clientId: string): PersistedUploadTarget {
    return {
        requestId: REQUEST_ID,
        clientId,
        name: `${clientId}.bin`,
        path: `${clientId}.bin`,
        parentPath: "",
        parentId: "parent",
        size: 10,
        sha256: "a".repeat(64),
        status: "planning",
        updatedAt: 0,
    };
}

function session(status: PersistedUploadSession["status"] = "paused"): PersistedUploadSession {
    return {
        requestId: REQUEST_ID,
        kind: "drive",
        name: "Upload",
        current: "parent",
        status,
        totalBytes: 10,
        createdAt: 0,
        updatedAt: 0,
        directories: [],
    };
}

function intent(intentId: string, acknowledgedParts = [0]): PersistedUploadIntent {
    return {
        requestId: REQUEST_ID,
        intentId,
        url: "/upload",
        token: "token",
        sha256: "a".repeat(64),
        state: "paused",
        totalParts: 4,
        acknowledgedParts,
        attemptCount: 1,
        updatedAt: 0,
    };
}

function snapshot(
    status: PersistedUploadSession["status"],
    targets: PersistedUploadTarget[],
    intents: PersistedUploadIntent[] = [],
): UploadSessionSnapshot {
    return { session: session(status), targets, intents };
}

describe("applyUploadPlan", () => {
    it("stages uploaded and deduplicated NTE members until bundle completion", () => {
        const result = applyUploadPlan({
            response: {
                requestId: REQUEST_ID,
                items: [
                    {
                        clientId: "utoc",
                        status: "pending",
                        intentId: "upload-utoc",
                        bundleId: "bundle",
                    },
                    {
                        clientId: "ucas",
                        status: "pending",
                        intentId: "dedup-ucas",
                        bundleId: "bundle",
                    },
                ],
                uploads: [
                    {
                        intentId: "upload-utoc",
                        url: "/upload-utoc",
                        method: "POST",
                        form: { token: "token", sha256: "a".repeat(64) },
                    },
                ],
                nteBundles: [
                    {
                        id: "bundle",
                        memberClientIds: ["utoc", "ucas"],
                        completeUrl: "/complete",
                        abortUrl: "/abort",
                        form: { token: "bundle-token" },
                    },
                ],
            },
            targets: [target("utoc"), target("ucas")],
            now: NOW,
        });

        expect(result.targets).toEqual([
            expect.objectContaining({ clientId: "utoc", status: "pending", bundleId: "bundle" }),
            expect.objectContaining({ clientId: "ucas", status: "staged", bundleId: "bundle" }),
        ]);
        expect(result.intents.map((item) => item.intentId)).toEqual(["upload-utoc"]);
        expect(result.nteBundles).toEqual([
            expect.objectContaining({ id: "bundle", state: "pending", token: "bundle-token" }),
        ]);
    });

    it("maps every server status by stable clientId and preserves its reason", () => {
        const response: UploadPlanResponse = {
            requestId: REQUEST_ID,
            items: [
                { clientId: "created", status: "created", itemId: "item-created" },
                { clientId: "exists", status: "exists", itemId: "item-exists" },
                { clientId: "pending", status: "pending", intentId: "intent-pending" },
                { clientId: "denied", status: "denied", reason: "unsupported_file_type" },
                { clientId: "error", status: "error", reason: "name_conflict" },
            ],
            uploads: [
                {
                    intentId: "intent-pending",
                    url: "/akasha/v2/uploads/intent-pending",
                    method: "POST",
                    form: { token: "token", sha256: "a".repeat(64) },
                },
            ],
        };

        const result = applyUploadPlan({
            response,
            targets: ["created", "exists", "pending", "denied", "error"].map(target),
            now: NOW,
        });

        expect(
            result.targets.map(({ clientId, status, reason }) => ({ clientId, status, reason })),
        ).toEqual([
            { clientId: "created", status: "created", reason: undefined },
            { clientId: "exists", status: "exists", reason: undefined },
            { clientId: "pending", status: "pending", reason: undefined },
            {
                clientId: "denied",
                status: "denied",
                reason: "unsupported_file_type",
            },
            { clientId: "error", status: "failed", reason: "name_conflict" },
        ]);
        expect(result.intents).toEqual([
            expect.objectContaining({
                intentId: "intent-pending",
                token: "token",
                state: "pending",
                acknowledgedParts: [],
                attemptCount: 0,
            }),
        ]);
    });

    it("creates work only for uploads referenced by a pending plan item", () => {
        const result = applyUploadPlan({
            response: {
                requestId: REQUEST_ID,
                items: [{ clientId: "pending", status: "pending", intentId: "wanted" }],
                uploads: [
                    {
                        intentId: "wanted",
                        url: "/wanted",
                        method: "POST",
                        form: { token: "wanted-token", sha256: "a".repeat(64) },
                    },
                    {
                        intentId: "orphan",
                        url: "/orphan",
                        method: "POST",
                        form: { token: "orphan-token", sha256: "b".repeat(64) },
                    },
                ],
            },
            targets: [target("pending")],
            now: NOW,
        });

        expect(result.intents.map((intent) => intent.intentId)).toEqual(["wanted"]);
    });

    it("marks missing and malformed per-file results as explicit failures", () => {
        const result = applyUploadPlan({
            response: {
                requestId: REQUEST_ID,
                items: [{ clientId: "malformed", status: "pending" }],
                uploads: [],
            },
            targets: [target("missing"), target("malformed")],
            now: NOW,
        });

        expect(result.targets).toEqual([
            expect.objectContaining({ status: "failed", reason: "plan_result_missing" }),
            expect.objectContaining({ status: "failed", reason: "invalid_plan_response" }),
        ]);
    });

    it("treats an invalid NTE plan denial as a terminal failure", () => {
        const result = applyUploadPlan({
            response: {
                requestId: REQUEST_ID,
                items: [
                    {
                        clientId: "invalid",
                        status: "denied",
                        reason: "invalid_nte_mod_file",
                    },
                ],
                uploads: [],
            },
            targets: [target("invalid")],
            now: NOW,
        });

        expect(result.targets).toEqual([
            expect.objectContaining({ status: "failed", reason: "invalid_nte_mod_file" }),
        ]);
    });
});

describe("getUploadRetryDecision", () => {
    it("retries network, pending, throttling, and server failures with capped backoff", () => {
        expect(
            getUploadRetryDecision({ attemptCount: 1, networkError: true, now: NOW }),
        ).toMatchObject({ retry: true, delayMs: 1_000, nextRetryAt: NOW + 1_000 });
        expect(
            getUploadRetryDecision({ attemptCount: 2, responseStatus: 202, pending: true }),
        ).toMatchObject({ retry: true, reason: "pending", delayMs: 2_000 });
        expect(
            getUploadRetryDecision({ attemptCount: 3, responseStatus: 429, retryAfterMs: 10_000 }),
        ).toMatchObject({ retry: true, delayMs: 10_000 });
        expect(
            getUploadRetryDecision({ attemptCount: 6, responseStatus: 524, maxRetries: 10 }),
        ).toMatchObject({ retry: true, delayMs: 30_000 });
    });

    it("does not retry terminal client errors or an exhausted retry budget", () => {
        expect(getUploadRetryDecision({ attemptCount: 1, responseStatus: 403 })).toEqual({
            retry: false,
            reason: "non_retryable_failure",
        });
        expect(getUploadRetryDecision({ attemptCount: 5, responseStatus: 500 })).toEqual({
            retry: false,
            reason: "retry_limit_reached",
        });
    });
});

describe("createChunkIndexes", () => {
    it("uses the v2 zero-based half-open part range", () => {
        expect(createChunkIndexes(1)).toEqual([0]);
        expect(createChunkIndexes(4)).toEqual([0, 1, 2, 3]);
        expect(() => createChunkIndexes(0)).toThrow("invalid_total_parts");
        expect(() => createChunkIndexes(1.5)).toThrow("invalid_total_parts");
    });
});

describe("summarizeUploadTargets", () => {
    it("splits success, excluded, failed, retryable, and open outcomes", () => {
        expect(
            summarizeUploadTargets([
                { ...target("created"), status: "created" },
                { ...target("exists"), status: "exists" },
                { ...target("completed"), status: "completed" },
                { ...target("denied"), status: "denied" },
                { ...target("failed"), status: "failed" },
                { ...target("cancelled"), status: "cancelled" },
                { ...target("paused"), status: "paused" },
                { ...target("staged"), status: "staged" },
                { ...target("uploading"), status: "uploading" },
            ]),
        ).toEqual({
            completed: 3,
            excluded: 1,
            failed: 2,
            retryable: 2,
            open: 1,
            total: 9,
        });
    });
});

describe("getUploadByteProgress", () => {
    it("adds committed success and excluded bytes to inflight", () => {
        expect(
            getUploadByteProgress(
                {
                    session: { ...session("uploading"), totalBytes: 100 },
                    targets: [
                        { ...target("a"), status: "completed", size: 40 },
                        { ...target("b"), status: "denied", size: 10 },
                        { ...target("c"), status: "uploading", size: 50 },
                    ],
                },
                { job: 25 },
            ),
        ).toEqual({
            committedBytes: 50,
            inflightBytes: 25,
            uploadedBytes: 75,
            percent: 75,
        });
    });

    it("clamps progress at 100 when inflight overlaps committed bytes", () => {
        expect(
            getUploadByteProgress(
                {
                    session: { ...session("uploading"), totalBytes: 50 },
                    targets: [{ ...target("a"), status: "completed", size: 40 }],
                },
                { job: 20 },
            ),
        ).toEqual({
            committedBytes: 40,
            inflightBytes: 20,
            uploadedBytes: 50,
            percent: 100,
        });
    });

    it("treats an empty completed session as 100 percent", () => {
        expect(
            getUploadByteProgress({
                session: { ...session("completed"), totalBytes: 0 },
                targets: [],
            }).percent,
        ).toBe(100);
        expect(
            getUploadByteProgress({
                session: { ...session("uploading"), totalBytes: 0 },
                targets: [],
            }).percent,
        ).toBe(0);
    });
});

describe("getFinalUploadSessionStatus", () => {
    it("completes when remaining files were only denied by the server", () => {
        expect(
            getFinalUploadSessionStatus([
                { ...target("completed"), status: "completed" },
                { ...target("denied"), status: "denied" },
            ]),
        ).toBe("completed");
        expect(getFinalUploadSessionStatus([{ ...target("denied"), status: "denied" }])).toBe(
            "completed",
        );
    });

    it("stays partial when a real failure remains beside excluded files", () => {
        expect(
            getFinalUploadSessionStatus([
                { ...target("denied"), status: "denied" },
                { ...target("failed"), status: "failed" },
            ]),
        ).toBe("partial");
    });

    it("treats cancelled leftovers as the same failure class as failed", () => {
        expect(getFinalUploadSessionStatus([{ ...target("cancelled"), status: "cancelled" }])).toBe(
            "partial",
        );
    });

    it("pauses when a retryable target is still open", () => {
        expect(
            getFinalUploadSessionStatus([
                { ...target("denied"), status: "denied" },
                { ...target("paused"), status: "paused" },
            ]),
        ).toBe("paused");
    });
});

describe("isPlanTerminal", () => {
    it("treats success, excluded, and failed outcomes as terminal", () => {
        expect(isPlanTerminal({ ...target("completed"), status: "completed" })).toBe(true);
        expect(isPlanTerminal({ ...target("denied"), status: "denied" })).toBe(true);
        expect(isPlanTerminal({ ...target("failed"), status: "failed" })).toBe(true);
        expect(isPlanTerminal({ ...target("cancelled"), status: "cancelled" })).toBe(true);
        expect(isPlanTerminal({ ...target("pending"), status: "pending" })).toBe(false);
        expect(isPlanTerminal({ ...target("planning"), status: "planning" })).toBe(false);
    });
});

describe("upload session recovery policy", () => {
    it("replans failed targets and removes only their stale intents", () => {
        const failed = {
            ...target("failed"),
            status: "failed" as const,
            reason: "invalid_token",
            intentId: "stale",
            itemId: "failed-item",
        };
        const paused = {
            ...target("paused"),
            status: "paused" as const,
            intentId: "resumable",
        };
        const completed = { ...target("completed"), status: "completed" as const };
        const result = prepareUploadRetry(
            snapshot(
                "partial",
                [failed, paused, completed],
                [intent("stale"), intent("resumable")],
            ),
            NOW,
        );

        expect(result.staleIntentIds).toEqual(["stale"]);
        expect(result.intents.map((item) => item.intentId)).toEqual(["resumable"]);
        expect(result.targets).toEqual([
            expect.objectContaining({
                clientId: "failed",
                status: "planning",
                updatedAt: NOW,
            }),
            paused,
            completed,
        ]);
        expect(result.targets[0]).not.toHaveProperty("reason");
        expect(result.targets[0]).not.toHaveProperty("intentId");
        expect(result.targets[0]).not.toHaveProperty("itemId");
    });

    it("does not retry oversized files or NTE groups", () => {
        expect(
            getUploadSessionActionAvailability(
                snapshot("partial", [
                    { ...target("big"), status: "failed", reason: "file_too_large" },
                ]),
            ),
        ).toMatchObject({ canRetry: false });
        expect(
            getUploadSessionActionAvailability(
                snapshot("partial", [
                    { ...target("huge"), status: "failed", reason: "nte_bundle_too_large" },
                ]),
            ),
        ).toMatchObject({ canRetry: false });
    });

    it("does not retry an invalid NTE bundle", () => {
        const invalid = {
            ...target("invalid"),
            status: "failed" as const,
            reason: "invalid_nte_mod_file",
            intentId: "invalid-intent",
            bundleId: "bundle",
        };
        const result = prepareUploadRetry(
            snapshot("partial", [invalid], [intent("invalid-intent")]),
            NOW,
        );

        expect(result.targets).toEqual([invalid]);
        expect(result.staleIntentIds).toEqual([]);
        expect(
            getUploadSessionActionAvailability(
                snapshot("partial", [invalid], [intent("invalid-intent")]),
            ),
        ).toMatchObject({ canRetry: false });
    });

    it("exposes retry, cancel, and dismiss actions for each recovery state", () => {
        expect(
            getUploadSessionActionAvailability(
                snapshot("uploading", [{ ...target("pending"), status: "pending" }]),
            ),
        ).toEqual({ canRetry: false, canCancel: true, canDismiss: false });
        expect(
            getUploadSessionActionAvailability(
                snapshot("planning", [{ ...target("planning"), status: "planning" }]),
            ),
        ).toEqual({ canRetry: false, canCancel: true, canDismiss: false });
        expect(
            getUploadSessionActionAvailability(
                snapshot("failed", [{ ...target("staging"), status: "staging" }]),
            ),
        ).toEqual({ canRetry: true, canCancel: true, canDismiss: false });
        expect(
            getUploadSessionActionAvailability(
                snapshot("paused", [{ ...target("paused"), status: "paused" }]),
            ),
        ).toEqual({ canRetry: true, canCancel: true, canDismiss: false });
        expect(
            getUploadSessionActionAvailability(
                snapshot("partial", [{ ...target("failed"), status: "failed" }]),
            ),
        ).toEqual({ canRetry: true, canCancel: false, canDismiss: true });
        expect(getUploadSessionActionAvailability(snapshot("completed", []))).toEqual({
            canRetry: false,
            canCancel: false,
            canDismiss: true,
        });
        expect(getUploadSessionActionAvailability(snapshot("cancelled", []))).toEqual({
            canRetry: false,
            canCancel: false,
            canDismiss: true,
        });
    });

    it("requires server ids for directory-only uploads before considering mapping complete", () => {
        const directoryOnly = snapshot("creating_directories", []);
        directoryOnly.session.directories = [
            { path: "empty", name: "empty", parentPath: "" },
            { path: "empty/nested", name: "nested", parentPath: "empty" },
        ];

        expect(hasCompleteDirectoryMapping(directoryOnly)).toBe(false);
        expect(
            hasCompleteDirectoryMapping({
                ...directoryOnly,
                session: {
                    ...directoryOnly.session,
                    directories: directoryOnly.session.directories.map((directory, index) => ({
                        ...directory,
                        itemId: `directory-${index}`,
                    })),
                },
            }),
        ).toBe(true);
    });

    it("preserves multipart checkpoints when completing an attempt", () => {
        expect(
            completeUploadIntentAttempt(intent("multipart", [0, 1, 2]), { status: "paused" }, NOW),
        ).toMatchObject({
            state: "paused",
            totalParts: 4,
            acknowledgedParts: [0, 1, 2],
            attemptCount: 2,
            updatedAt: NOW,
        });
    });

    it("updates only targets owned by one intent", () => {
        const first = { ...target("first"), intentId: "shared", status: "uploading" as const };
        const second = { ...target("second"), intentId: "shared", status: "uploading" as const };
        const unrelated = {
            ...target("unrelated"),
            intentId: "other",
            status: "completed" as const,
        };

        expect(
            getIntentTargetUpdates(
                [first, second, unrelated],
                "shared",
                "failed",
                "network_error",
                NOW,
            ),
        ).toEqual([
            { ...first, status: "failed", reason: "network_error", updatedAt: NOW },
            { ...second, status: "failed", reason: "network_error", updatedAt: NOW },
        ]);
    });

    it("cancels unfinished work while preserving completed and failed results", () => {
        const pending = { ...target("pending"), status: "uploading" as const };
        const completed = { ...target("completed"), status: "completed" as const };
        const failed = { ...target("failed"), status: "failed" as const };
        const result = prepareUploadCancellation(
            snapshot(
                "uploading",
                [pending, completed, failed],
                [
                    { ...intent("pending-intent"), state: "uploading" },
                    { ...intent("completed-intent"), state: "completed" },
                ],
            ),
            NOW,
        );

        expect(result.session).toMatchObject({
            status: "cancelled",
            reason: "page_unloaded",
            updatedAt: NOW,
        });
        expect(result.targets).toEqual([
            { ...pending, status: "cancelled", reason: "page_unloaded", updatedAt: NOW },
            completed,
            failed,
        ]);
        expect(result.intents).toEqual([
            expect.objectContaining({ state: "cancelled", updatedAt: NOW }),
            expect.objectContaining({ state: "completed", updatedAt: 0 }),
        ]);
    });
});
