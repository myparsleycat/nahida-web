/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UploadSessionSnapshot } from "./types";

const mocks = vi.hoisted(() => ({
    acquireUploadSessionLease: vi.fn(),
    releaseUploadSessionLease: vi.fn(),
    renewUploadSessionLease: vi.fn(),
    loadUploadSessionSnapshot: vi.fn(),
    getUploadIntent: vi.fn(),
    saveUploadSession: vi.fn(),
    saveUploadTargets: vi.fn(),
    saveUploadIntent: vi.fn(),
    saveUploadIntents: vi.fn(),
    deleteUploadIntent: vi.fn(),
    deleteUploadSession: vi.fn(),
    listIncompleteUploadSessionSnapshots: vi.fn(),
    uploadIntentBytes: vi.fn(),
    uploadPackBytes: vi.fn(),
    invalidateQueries: vi.fn(),
}));

vi.mock("@/integrations/queryClient", () => ({
    queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

vi.mock("@/lib/eden", () => ({ eden: {} }));

vi.mock("@/lib/opfs", () => ({ cleanupUploadOpfsArtifacts: vi.fn() }));

vi.mock("@/lib/utils", () => ({
    compressData: vi.fn(async () => ({ isCompressed: false })),
}));

vi.mock("@/lib/workers/upload/hash-pool", () => ({
    calculateHashesInParallel: vi.fn(),
}));

vi.mock("./planner", () => ({ planUploadSession: vi.fn() }));

vi.mock("./transport", () => ({
    abortNteBundle: vi.fn(),
    completeNteBundle: vi.fn(),
    uploadIntentBytes: mocks.uploadIntentBytes,
    uploadPackBytes: mocks.uploadPackBytes,
}));

vi.mock("./repository", () => ({
    acquireUploadSessionLease: mocks.acquireUploadSessionLease,
    releaseUploadSessionLease: mocks.releaseUploadSessionLease,
    renewUploadSessionLease: mocks.renewUploadSessionLease,
    loadUploadSessionSnapshot: mocks.loadUploadSessionSnapshot,
    getUploadIntent: mocks.getUploadIntent,
    saveUploadSession: mocks.saveUploadSession,
    saveUploadTargets: mocks.saveUploadTargets,
    saveUploadIntent: mocks.saveUploadIntent,
    saveUploadIntents: mocks.saveUploadIntents,
    deleteUploadIntent: mocks.deleteUploadIntent,
    deleteUploadSession: mocks.deleteUploadSession,
    listIncompleteUploadSessionSnapshots: mocks.listIncompleteUploadSessionSnapshots,
}));

import { startUploadSession } from "./session";

function plannedSnapshot(requestId: string): UploadSessionSnapshot {
    return {
        session: {
            requestId,
            kind: "drive",
            name: "upload",
            current: "current",
            status: "planning",
            totalBytes: 2,
            createdAt: 0,
            updatedAt: 0,
            directories: [],
        },
        targets: [
            {
                requestId,
                clientId: "keep",
                name: "keep.bin",
                path: "keep.bin",
                parentPath: "",
                parentId: "current",
                size: 1,
                sha256: "a".repeat(64),
                status: "pending",
                intentId: "intent-keep",
                updatedAt: 0,
            },
            {
                requestId,
                clientId: "gone",
                name: "gone.bin",
                path: "gone.bin",
                parentPath: "",
                parentId: "current",
                size: 1,
                sha256: "b".repeat(64),
                status: "pending",
                intentId: "intent-gone",
                updatedAt: 0,
            },
        ],
        intents: [
            {
                requestId,
                intentId: "intent-keep",
                url: "https://api.nahida.live/akasha/v2/uploads/intent-keep",
                token: "token",
                sha256: "a".repeat(64),
                state: "pending",
                acknowledgedParts: [],
                attemptCount: 0,
                updatedAt: 0,
            },
            {
                requestId,
                intentId: "intent-gone",
                url: "https://api.nahida.live/akasha/v2/uploads/intent-gone",
                token: "token",
                sha256: "b".repeat(64),
                state: "pending",
                acknowledgedParts: [],
                attemptCount: 0,
                updatedAt: 0,
            },
        ],
    };
}

describe("startUploadSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.acquireUploadSessionLease.mockResolvedValue(true);
        mocks.releaseUploadSessionLease.mockResolvedValue(true);
        mocks.uploadIntentBytes.mockResolvedValue({ status: "completed" });
        mocks.uploadPackBytes.mockResolvedValue([{ status: "completed" }]);
        mocks.saveUploadSession.mockResolvedValue(undefined);
        mocks.saveUploadTargets.mockResolvedValue(undefined);
        mocks.saveUploadIntent.mockResolvedValue(undefined);
        mocks.saveUploadIntents.mockResolvedValue(undefined);
        mocks.getUploadIntent.mockImplementation(async (requestId: string, intentId: string) =>
            plannedSnapshot(requestId).intents.find((intent) => intent.intentId === intentId),
        );
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) =>
            plannedSnapshot(requestId),
        );
    });

    it("fails only the missing source and still uploads the remaining intent", async () => {
        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                {
                    FID: "keep",
                    clientId: "keep",
                    path: "keep.bin",
                    name: "keep.bin",
                    size: 1,
                    parentPath: "",
                    file: new File(["a"], "keep.bin"),
                },
            ],
            directories: [],
        });

        expect(mocks.uploadIntentBytes).toHaveBeenCalledTimes(1);
        expect(mocks.uploadIntentBytes.mock.calls[0]?.[0].intent.intentId).toBe("intent-keep");
        expect(mocks.saveUploadTargets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ intentId: "intent-gone", status: "failed" }),
            ]),
        );
    });
});
