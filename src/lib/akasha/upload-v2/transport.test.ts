import { describe, expect, it } from "vitest";

import type { PersistedUploadIntent } from "./types";

import { uploadIntentBytes, uploadPackBytes } from "./transport";

describe("uploadIntentBytes", () => {
    it("does not start a request when the page signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort("page_unloaded");

        await expect(
            uploadIntentBytes({
                intent: {
                    requestId: "request",
                    intentId: "intent",
                    url: "/upload",
                    token: "token",
                    sha256: "a".repeat(64),
                    state: "pending",
                    acknowledgedParts: [],
                    attemptCount: 0,
                    updatedAt: 0,
                } satisfies PersistedUploadIntent,
                file: new File(["content"], "file.bin"),
                signal: controller.signal,
            }),
        ).resolves.toEqual({ status: "paused", reason: "aborted" });
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
});
