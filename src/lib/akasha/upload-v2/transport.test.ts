import { describe, expect, it, vi } from "vitest";

import type { PersistedUploadIntent } from "./types";

import { completeNteBundle, uploadIntentBytes, uploadPackBytes } from "./transport";

const intent = {
    requestId: "request",
    intentId: "intent",
    url: "/upload",
    token: "token",
    sha256: "a".repeat(64),
    state: "pending" as const,
    acknowledgedParts: [],
    attemptCount: 0,
    updatedAt: 0,
} satisfies PersistedUploadIntent;

describe("uploadIntentBytes", () => {
    it("does not start a request when the page signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort("page_unloaded");

        await expect(
            uploadIntentBytes({
                intent,
                file: new File(["content"], "file.bin"),
                signal: controller.signal,
            }),
        ).resolves.toEqual({ status: "paused", reason: "aborted" });
    });

    it("accepts exactly 1 GiB and rejects one byte more without allocating the file", async () => {
        const fetchMock = vi.fn(
            async () =>
                new Response(JSON.stringify({ status: "completed" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const exact = {
            size: 1024 ** 3,
            slice: vi.fn(() => new Blob()),
        } as unknown as File;
        const oversized = { size: 1024 ** 3 + 1 } as File;

        try {
            await expect(uploadIntentBytes({ intent, file: exact })).resolves.toEqual({
                status: "completed",
            });
            await expect(uploadIntentBytes({ intent, file: oversized })).resolves.toEqual({
                status: "failed",
                reason: "file_too_large",
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

const nteBundle = {
    id: "bundle",
    memberClientIds: ["utoc", "ucas"],
    completeUrl: "/complete",
    abortUrl: "/abort",
    token: "bundle-token",
    state: "pending" as const,
    updatedAt: 0,
};

describe("completeNteBundle", () => {
    it("posts the bundle token and preserves an invalid NTE error code", async () => {
        const fetchMock = vi.fn(
            async (_url: string, _init: RequestInit) =>
                new Response(JSON.stringify({ code: "invalid_nte_mod_file" }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                }),
        );
        vi.stubGlobal("fetch", fetchMock);

        try {
            await expect(completeNteBundle(nteBundle)).resolves.toEqual({
                status: "failed",
                reason: "invalid_nte_mod_file",
            });
            expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
                JSON.stringify({ token: "bundle-token" }),
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("keeps polling 202 responses until the bundle completes", async () => {
        vi.useFakeTimers();
        let calls = 0;
        const fetchMock = vi.fn(async () => {
            calls++;
            return new Response(JSON.stringify({ status: calls <= 5 ? "pending" : "completed" }), {
                status: calls <= 5 ? 202 : 200,
                headers: { "content-type": "application/json" },
            });
        });
        vi.stubGlobal("fetch", fetchMock);

        try {
            const pending = completeNteBundle(nteBundle);
            await vi.runAllTimersAsync();
            await expect(pending).resolves.toEqual({ status: "completed" });
            expect(fetchMock).toHaveBeenCalledTimes(6);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

    it("pauses after retryable transport failures exhaust RETRY_LIMIT", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn(
            async () =>
                new Response(JSON.stringify({ status: "error" }), {
                    status: 500,
                    headers: { "content-type": "application/json" },
                }),
        );
        vi.stubGlobal("fetch", fetchMock);

        try {
            const pending = completeNteBundle(nteBundle);
            await vi.runAllTimersAsync();
            await expect(pending).resolves.toEqual({ status: "paused", reason: "http_500" });
            expect(fetchMock).toHaveBeenCalledTimes(4);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });
});

describe("uploadPackBytes", () => {
    it("does not start a request when the page signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort("page_unloaded");
        const intent = {
            requestId: "request",
            intentId: "intent-a",
            url: "/akasha/v2/uploads/intent-a",
            token: "token",
            sha256: "a".repeat(64),
            state: "pending" as const,
            acknowledgedParts: [],
            attemptCount: 0,
            updatedAt: 0,
        } satisfies PersistedUploadIntent;

        await expect(
            uploadPackBytes({
                members: [
                    {
                        intent,
                        file: new File(["a"], "a.bin"),
                        logicalSize: 1,
                        payloadBytes: 1,
                    },
                    {
                        intent: {
                            ...intent,
                            intentId: "intent-b",
                            url: "/akasha/v2/uploads/intent-b",
                        },
                        file: new File(["b"], "b.bin"),
                        logicalSize: 1,
                        payloadBytes: 1,
                    },
                ],
                signal: controller.signal,
            }),
        ).resolves.toEqual([
            { status: "paused", reason: "aborted" },
            { status: "paused", reason: "aborted" },
        ]);
    });

    it("returns paused when aborted during retry backoff", async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        vi.stubGlobal(
            "XMLHttpRequest",
            class {
                upload = {};
                status = 500;
                response = new ArrayBuffer(0);
                onload: (() => void) | null = null;
                onabort: (() => void) | null = null;
                open() {}
                send() {
                    queueMicrotask(() => this.onload?.());
                }
                abort() {
                    this.onabort?.();
                }
                getResponseHeader() {
                    return null;
                }
            },
        );
        const intent = {
            requestId: "request",
            intentId: "intent-a",
            url: "/akasha/v2/uploads/intent-a",
            token: "token",
            sha256: "a".repeat(64),
            state: "pending" as const,
            acknowledgedParts: [],
            attemptCount: 0,
            updatedAt: 0,
        } satisfies PersistedUploadIntent;

        try {
            const pending = uploadPackBytes({
                members: [
                    {
                        intent,
                        file: new File(["a"], "a.bin"),
                        logicalSize: 1,
                        payloadBytes: 1,
                    },
                    {
                        intent: { ...intent, intentId: "intent-b" },
                        file: new File(["b"], "b.bin"),
                        logicalSize: 1,
                        payloadBytes: 1,
                    },
                ],
                signal: controller.signal,
            });
            await Promise.resolve();
            controller.abort();
            await expect(pending).resolves.toEqual([
                { status: "paused", reason: "aborted" },
                { status: "paused", reason: "aborted" },
            ]);
        } finally {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        }
    });

    it("maps reversed pack results by intentId", async () => {
        const body = new TextEncoder().encode(
            JSON.stringify({
                results: [
                    { intentId: "intent-b", status: "failed", reason: "sha256_mismatch" },
                    { intentId: "intent-a", status: "completed" },
                ],
            }),
        );
        vi.stubGlobal(
            "XMLHttpRequest",
            class {
                upload = {};
                status = 200;
                response = body.buffer;
                onload: (() => void) | null = null;
                open() {}
                send() {
                    queueMicrotask(() => this.onload?.());
                }
                abort() {}
                getResponseHeader() {
                    return "application/json";
                }
            },
        );
        const intent = {
            requestId: "request",
            intentId: "intent-a",
            url: "/akasha/v2/uploads/intent-a",
            token: "token",
            sha256: "a".repeat(64),
            state: "pending" as const,
            acknowledgedParts: [],
            attemptCount: 0,
            updatedAt: 0,
        } satisfies PersistedUploadIntent;

        try {
            await expect(
                uploadPackBytes({
                    members: [
                        {
                            intent,
                            file: new File(["a"], "a.bin"),
                            logicalSize: 1,
                            payloadBytes: 1,
                        },
                        {
                            intent: { ...intent, intentId: "intent-b" },
                            file: new File(["b"], "b.bin"),
                            logicalSize: 1,
                            payloadBytes: 1,
                        },
                    ],
                }),
            ).resolves.toEqual([
                { status: "completed" },
                { status: "failed", reason: "sha256_mismatch" },
            ]);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
