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
    abortNteBundle: vi.fn(),
    completeNteBundle: vi.fn(),
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
    abortNteBundle: mocks.abortNteBundle,
    completeNteBundle: mocks.completeNteBundle,
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
        mocks.abortNteBundle.mockResolvedValue(undefined);
        mocks.completeNteBundle.mockResolvedValue({ status: "completed" });
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

    it("records sibling bundle aborts as nte_bundle_incomplete and keeps the original failure", async () => {
        let current: UploadSessionSnapshot | undefined;
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) => {
            if (!current || current.session.requestId !== requestId) {
                current = nteBundleSnapshot(requestId);
            }
            return current;
        });
        mocks.getUploadIntent.mockImplementation(async (_requestId: string, intentId: string) =>
            current?.intents.find((intent) => intent.intentId === intentId),
        );
        mocks.saveUploadTargets.mockImplementation(async (targets: UploadSessionSnapshot["targets"]) => {
            if (!current) return;
            const byClient = new Map(targets.map((target) => [target.clientId, target]));
            current.targets = current.targets.map((target) => byClient.get(target.clientId) ?? target);
        });
        mocks.saveUploadSession.mockImplementation(async (session) => {
            if (!current) return;
            current.session = session;
        });
        mocks.uploadIntentBytes.mockImplementation(async ({ intent, signal }) => {
            if (intent.intentId === "intent-pak") {
                return { status: "failed" as const, reason: "invalid_nte_mod_file" };
            }
            await new Promise<void>((_, reject) => {
                if (signal?.aborted) {
                    reject(new DOMException("Aborted", "AbortError"));
                    return;
                }
                signal?.addEventListener(
                    "abort",
                    () => reject(new DOMException("Aborted", "AbortError")),
                    { once: true },
                );
            });
            return { status: "paused" as const, reason: "aborted" };
        });

        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                nteFile("pak", "Character.pak"),
                nteFile("utoc", "Character.utoc"),
                nteFile("ucas", "Character.ucas"),
            ],
            directories: [],
        });

        expect(mocks.saveUploadTargets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    clientId: "utoc",
                    status: "failed",
                    reason: "nte_bundle_incomplete",
                }),
            ]),
        );
        expect(mocks.saveUploadTargets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ clientId: "pak", reason: "invalid_nte_mod_file" }),
                expect.objectContaining({ clientId: "utoc", reason: "invalid_nte_mod_file" }),
                expect.objectContaining({ clientId: "ucas", reason: "invalid_nte_mod_file" }),
            ]),
        );
        expect(
            mocks.saveUploadTargets.mock.calls
                .flatMap((call) => call[0])
                .some((target) => target.reason === "Aborted"),
        ).toBe(false);
        expect(mocks.abortNteBundle).toHaveBeenCalled();
        expect(current?.session.errorCode).toBe("invalid_nte_mod_file");
    });
});

function nteFile(clientId: string, name: string) {
    return {
        FID: clientId,
        clientId,
        path: name,
        name,
        size: 1,
        parentPath: "",
        file: new File([clientId], name),
    };
}

function nteBundleSnapshot(requestId: string): UploadSessionSnapshot {
    const members = ["pak", "utoc", "ucas"] as const;
    return {
        session: {
            requestId,
            kind: "drive",
            name: "upload",
            current: "current",
            status: "planning",
            totalBytes: 3,
            createdAt: 0,
            updatedAt: 0,
            directories: [],
            nteBundles: [
                {
                    id: "bundle",
                    memberClientIds: [...members],
                    completeUrl: "/complete",
                    abortUrl: "/abort",
                    token: "token",
                    state: "pending",
                    updatedAt: 0,
                },
            ],
        },
        targets: members.map((clientId) => ({
            requestId,
            clientId,
            name: `Character.${clientId}`,
            path: `Character.${clientId}`,
            parentPath: "",
            parentId: "current",
            size: 1,
            sha256: "a".repeat(64),
            status: "pending" as const,
            intentId: `intent-${clientId}`,
            bundleId: "bundle",
            updatedAt: 0,
        })),
        intents: members.map((clientId) => ({
            requestId,
            intentId: `intent-${clientId}`,
            url: `https://api.nahida.live/akasha/v2/uploads/intent-${clientId}`,
            token: "token",
            sha256: "a".repeat(64),
            state: "pending" as const,
            acknowledgedParts: [],
            attemptCount: 0,
            updatedAt: 0,
        })),
    };
}
