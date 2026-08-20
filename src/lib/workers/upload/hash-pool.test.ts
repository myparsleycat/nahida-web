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

import { createSha256WorkerPool } from "./hash-pool";

describe("SHA-256 worker pool", () => {
    it("limits concurrent hash workers to two", () => {
        expect(createSha256WorkerPool(8)).toHaveLength(2);
        expect(WorkerMock).toHaveBeenCalledTimes(2);
    });
});
