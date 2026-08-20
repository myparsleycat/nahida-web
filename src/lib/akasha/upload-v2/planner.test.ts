import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistedUploadTarget } from "./types";

const postPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/eden", () => ({
    eden: {
        akasha: {
            v2: {
                drive: { "files:plan": { post: postPlan } },
            },
        },
    },
}));

import { NTE_BUNDLE_CAPABILITY, paginateUploadTargets, planUploadSession } from "./planner";

function target(clientId: string, name = `${clientId}.bin`): PersistedUploadTarget {
    return {
        requestId: "request",
        clientId,
        name,
        path: name,
        parentPath: "",
        parentId: "parent",
        size: 1,
        sha256: "a".repeat(64),
        status: "planning",
        updatedAt: 0,
    };
}

describe("paginateUploadTargets", () => {
    beforeEach(() => vi.clearAllMocks());

    it("advertises NTE bundle support to the existing plan endpoint", async () => {
        postPlan.mockResolvedValue({
            data: { requestId: "request", items: [], uploads: [], nteBundles: [] },
        });

        await planUploadSession(
            {
                requestId: "request",
                kind: "drive",
                name: "upload",
                current: "parent",
                status: "planning",
                totalBytes: 1,
                createdAt: 0,
                updatedAt: 0,
                directories: [],
            },
            [target("file")],
        );

        expect(postPlan).toHaveBeenCalledWith(
            expect.objectContaining({ capabilities: [NTE_BUNDLE_CAPABILITY] }),
        );
    });

    it("keeps an NTE basename group together at a 500-item boundary", () => {
        const standard = Array.from({ length: 499 }, (_, index) => target(`standard-${index}`));
        const pages = paginateUploadTargets([
            ...standard,
            target("pak", "Character.PAK"),
            target("utoc", "character.utoc"),
            target("ucas", "CHARACTER.ucas"),
            target("partition", "character_s1.ucas"),
        ]);

        expect(pages.map((page) => page.length)).toEqual([499, 4]);
        expect(pages[1].map((item) => item.clientId)).toEqual(["pak", "utoc", "ucas", "partition"]);
    });

    it("does not treat a suffix after an NTE extension as an NTE file", () => {
        const pages = paginateUploadTargets([
            ...Array.from({ length: 499 }, (_, index) => target(`standard-${index}`)),
            target("disabled", "character.pak.disabled"),
            target("utoc", "character.utoc"),
            target("ucas", "character.ucas"),
        ]);

        expect(pages.map((page) => page.length)).toEqual([500, 2]);
    });
});
