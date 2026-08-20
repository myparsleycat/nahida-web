/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const hasher = vi.hoisted(() => ({
    init: vi.fn(),
    update: vi.fn(),
    digest: vi.fn(() => "digest"),
}));

vi.mock("hash-wasm", () => ({ createSHA256: vi.fn(async () => hasher) }));

import "./akasha.sha256.worker";

describe("akasha SHA-256 worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(self, "postMessage").mockImplementation(() => undefined);
    });

    it("hashes files incrementally in 4 MiB slices", async () => {
        const bytes = new Uint8Array(4 * 1024 * 1024 + 1);

        await self.onmessage?.(
            new MessageEvent("message", {
                data: { files: [{ FID: "file", file: new File([bytes], "large.bin") }] },
            }),
        );

        expect(hasher.update).toHaveBeenCalledTimes(2);
        expect(hasher.update.mock.calls.map(([slice]) => slice.byteLength)).toEqual([
            4 * 1024 * 1024,
            1,
        ]);
        expect(self.postMessage).toHaveBeenLastCalledWith({
            type: "complete",
            hashes: [["file", "digest"]],
        });
    });
});
