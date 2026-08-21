/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/zstd", async () => {
    const { zstdCompressSync } = await import("node:zlib");
    return {
        default: {
            getInstance: async () => ({
                compress: (data: Uint8Array) => {
                    if (new TextDecoder().decode(data).includes("FAIL-COMPRESS")) {
                        throw new Error("zstd_failed");
                    }
                    return new Uint8Array(zstdCompressSync(data));
                },
            }),
        },
    };
});

import type { UploadSessionSnapshot } from "./types";

import { DIRECT_UPLOAD_THRESHOLD } from "./pack";

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

function snapshotFor(
    requestId: string,
    files: Array<{ clientId: string; name: string; size: number; bundleId?: string }>,
): UploadSessionSnapshot {
    return {
        session: {
            requestId,
            kind: "drive",
            name: "upload",
            current: "current",
            status: "planning",
            totalBytes: files.reduce((sum, file) => sum + file.size, 0),
            createdAt: 0,
            updatedAt: 0,
            directories: [],
        },
        targets: files.map((file) => ({
            requestId,
            clientId: file.clientId,
            name: file.name,
            path: file.name,
            parentPath: "",
            parentId: "current",
            size: file.size,
            sha256: "a".repeat(64),
            status: "pending",
            intentId: `intent-${file.clientId}`,
            bundleId: file.bundleId,
            updatedAt: 0,
        })),
        intents: files.map((file) => ({
            requestId,
            intentId: `intent-${file.clientId}`,
            url: `https://api.nahida.live/akasha/v2/uploads/intent-${file.clientId}`,
            token: "token",
            sha256: "a".repeat(64),
            state: "pending",
            acknowledgedParts: [],
            attemptCount: 0,
            updatedAt: 0,
        })),
    };
}

describe("startUploadSession compression", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.acquireUploadSessionLease.mockResolvedValue(true);
        mocks.releaseUploadSessionLease.mockResolvedValue(true);
        mocks.uploadIntentBytes.mockResolvedValue({ status: "completed" });
        mocks.uploadPackBytes.mockResolvedValue([{ status: "completed" }, { status: "completed" }]);
        mocks.abortNteBundle.mockResolvedValue(undefined);
        mocks.completeNteBundle.mockResolvedValue({ status: "completed" });
        mocks.saveUploadSession.mockResolvedValue(undefined);
        mocks.saveUploadTargets.mockResolvedValue(undefined);
        mocks.saveUploadIntent.mockResolvedValue(undefined);
        mocks.saveUploadIntents.mockResolvedValue(undefined);
        mocks.getUploadIntent.mockImplementation(async (requestId: string, intentId: string) => {
            const snapshot = await mocks.loadUploadSessionSnapshot(requestId);
            return snapshot?.intents.find((intent: { intentId: string }) => intent.intentId === intentId);
        });
    });

    it("packs non-excluded members as individually compressed zstd payloads", async () => {
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) =>
            snapshotFor(requestId, [
                { clientId: "one", name: "one.ini", size: 200 },
                { clientId: "two", name: "two.ini", size: 200 },
            ]),
        );

        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                {
                    FID: "one",
                    clientId: "one",
                    path: "one.ini",
                    name: "one.ini",
                    size: 200,
                    parentPath: "",
                    file: new File(["member-one-".repeat(20)], "one.ini"),
                },
                {
                    FID: "two",
                    clientId: "two",
                    path: "two.ini",
                    name: "two.ini",
                    size: 200,
                    parentPath: "",
                    file: new File(["member-two-".repeat(20)], "two.ini"),
                },
            ],
            directories: [],
        });

        expect(mocks.uploadPackBytes).toHaveBeenCalledTimes(1);
        const members = mocks.uploadPackBytes.mock.calls[0]?.[0].members as Array<{
            file: File;
            logicalSize: number;
            payloadBytes: number;
            intent: { compAlg?: string };
        }>;
        expect(members).toHaveLength(2);
        for (const member of members) {
            expect(member.intent.compAlg).toBe("zstd");
            expect(member.payloadBytes).not.toBe(member.logicalSize);
            expect(member.file.size).toBe(member.payloadBytes);
        }
    });

    it("compresses files at the multipart threshold", async () => {
        const contents = "huge-payload-".repeat(20);
        const source = new File([contents], "huge.ini");
        Object.defineProperty(source, "size", { value: DIRECT_UPLOAD_THRESHOLD });
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) =>
            snapshotFor(requestId, [
                { clientId: "huge", name: "huge.ini", size: DIRECT_UPLOAD_THRESHOLD },
            ]),
        );

        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                {
                    FID: "huge",
                    clientId: "huge",
                    path: "huge.ini",
                    name: "huge.ini",
                    size: DIRECT_UPLOAD_THRESHOLD,
                    parentPath: "",
                    file: source,
                },
            ],
            directories: [],
        });

        expect(mocks.uploadIntentBytes).toHaveBeenCalledTimes(1);
        const sent = mocks.uploadIntentBytes.mock.calls[0]?.[0] as {
            intent: { compAlg?: string };
            file: File;
        };
        expect(sent.intent.compAlg).toBe("zstd");
        expect(sent.file.size).not.toBe(DIRECT_UPLOAD_THRESHOLD);
        expect(sent.file.size).not.toBe(contents.length);
    });

    it("compresses nte members", async () => {
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) =>
            snapshotFor(requestId, [
                { clientId: "pak", name: "Character.pak", size: 200, bundleId: "bundle" },
            ]),
        );

        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                {
                    FID: "pak",
                    clientId: "pak",
                    path: "Character.pak",
                    name: "Character.pak",
                    size: 200,
                    parentPath: "",
                    file: new File(["pak-payload-".repeat(20)], "Character.pak"),
                },
            ],
            directories: [],
        });

        expect(mocks.uploadIntentBytes).toHaveBeenCalledTimes(1);
        const sent = mocks.uploadIntentBytes.mock.calls[0]?.[0] as {
            intent: { compAlg?: string };
            file: File;
        };
        expect(sent.intent.compAlg).toBe("zstd");
        expect(sent.file.size).not.toBe(200);
    });

    it("fails only the packed member whose compression fails", async () => {
        mocks.loadUploadSessionSnapshot.mockImplementation(async (requestId: string) =>
            snapshotFor(requestId, [
                { clientId: "one", name: "one.ini", size: 200 },
                { clientId: "bad", name: "bad.ini", size: 200 },
                { clientId: "two", name: "two.ini", size: 200 },
            ]),
        );

        await startUploadSession({
            kind: "drive",
            name: "upload",
            current: "current",
            files: [
                {
                    FID: "one",
                    clientId: "one",
                    path: "one.ini",
                    name: "one.ini",
                    size: 200,
                    parentPath: "",
                    file: new File(["member-one-".repeat(20)], "one.ini"),
                },
                {
                    FID: "bad",
                    clientId: "bad",
                    path: "bad.ini",
                    name: "bad.ini",
                    size: 200,
                    parentPath: "",
                    file: new File(["FAIL-COMPRESS-".repeat(20)], "bad.ini"),
                },
                {
                    FID: "two",
                    clientId: "two",
                    path: "two.ini",
                    name: "two.ini",
                    size: 200,
                    parentPath: "",
                    file: new File(["member-two-".repeat(20)], "two.ini"),
                },
            ],
            directories: [],
        });

        expect(mocks.uploadPackBytes).toHaveBeenCalledTimes(1);
        const members = mocks.uploadPackBytes.mock.calls[0]?.[0].members as Array<{
            intent: { intentId: string };
        }>;
        expect(members.map((member) => member.intent.intentId)).toEqual([
            "intent-one",
            "intent-two",
        ]);
        expect(mocks.saveUploadTargets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ intentId: "intent-bad", status: "failed" }),
            ]),
        );
    });
});
