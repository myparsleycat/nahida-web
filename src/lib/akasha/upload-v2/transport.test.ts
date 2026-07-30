import { describe, expect, it } from "vitest";

import type { PersistedUploadIntent } from "./types";

import { uploadIntentBytes } from "./transport";

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
