import { describe, expect, it } from "vitest";

import { PACK_MEMBER_MAX, packUploadUrl, partitionPackedUploads } from "./pack";

describe("partitionPackedUploads", () => {
    it("packs adjacent small files and keeps oversized files single", () => {
        const groups = partitionPackedUploads([
            { id: "a", payloadBytes: 10 },
            { id: "b", payloadBytes: 20 },
            { id: "c", payloadBytes: PACK_MEMBER_MAX + 1 },
            { id: "d", payloadBytes: 30 },
            { id: "e", payloadBytes: 40 },
        ]);

        expect(groups).toEqual([
            {
                kind: "pack",
                members: [
                    { id: "a", payloadBytes: 10 },
                    { id: "b", payloadBytes: 20 },
                ],
            },
            { kind: "single", member: { id: "c", payloadBytes: PACK_MEMBER_MAX + 1 } },
            {
                kind: "pack",
                members: [
                    { id: "d", payloadBytes: 30 },
                    { id: "e", payloadBytes: 40 },
                ],
            },
        ]);
    });
});

describe("packUploadUrl", () => {
    it("rewrites an intent upload URL to the pack endpoint", () => {
        expect(packUploadUrl("https://api.nahida.live/akasha/v2/uploads/intent-1")).toBe(
            "https://api.nahida.live/akasha/v2/uploads:pack",
        );
    });

    it("preserves a query string and fragment", () => {
        expect(
            packUploadUrl("https://api.nahida.live/akasha/v2/uploads/intent-1?sig=abc#frag"),
        ).toBe("https://api.nahida.live/akasha/v2/uploads:pack?sig=abc#frag");
    });

    it("throws when the URL has no intent upload segment", () => {
        expect(() => packUploadUrl("https://api.nahida.live/akasha/v2/other/intent-1?x=1")).toThrow(
            "pack_url_unresolved",
        );
    });
});
