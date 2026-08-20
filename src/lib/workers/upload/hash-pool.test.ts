/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

const WorkerMock = vi.hoisted(() =>
    vi.fn(
        class {
            onmessage = null;
            onerror = null;
            postMessage = vi.fn();
            terminate = vi.fn();
        },
    ),
);

vi.mock("@/lib/workers/akasha.sha256.worker?worker", () => ({ default: WorkerMock }));

import { calculateHashesInParallel, createSha256WorkerPool } from "./hash-pool";

describe("SHA-256 worker pool", () => {
    it("limits concurrent hash workers to two", () => {
        expect(createSha256WorkerPool(8)).toHaveLength(2);
        expect(WorkerMock).toHaveBeenCalledTimes(2);
    });

    it("removes peer abort listeners when one worker fails", async () => {
        WorkerMock.mockClear();
        WorkerMock.mockImplementation(function (this: {
            onmessage: ((event: MessageEvent) => void) | null;
            onerror: ((error: ErrorEvent) => void) | null;
            postMessage: (data: unknown) => void;
            terminate: () => void;
        }) {
            const index = WorkerMock.mock.calls.length - 1;
            this.onmessage = null;
            this.onerror = null;
            this.terminate = vi.fn();
            this.postMessage = vi.fn(() => {
                if (index !== 0) return;
                queueMicrotask(() => {
                    this.onmessage?.({ data: { type: "error", error: "hash failed" } } as MessageEvent);
                });
            });
        } as unknown as new () => Worker);

        const controller = new AbortController();
        const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
        const unhandled: unknown[] = [];
        const onUnhandled = (event: PromiseRejectionEvent) => {
            unhandled.push(event.reason);
            event.preventDefault();
        };
        window.addEventListener("unhandledrejection", onUnhandled);

        try {
            await expect(
                calculateHashesInParallel(
                    [
                        { FID: "a", file: new File(["a"], "a.bin") },
                        { FID: "b", file: new File(["b"], "b.bin") },
                    ],
                    undefined,
                    controller.signal,
                ),
            ).rejects.toThrow("hash failed");
            controller.abort();
            await Promise.resolve();
            expect(unhandled).toEqual([]);
            expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        } finally {
            window.removeEventListener("unhandledrejection", onUnhandled);
        }
    });
});
