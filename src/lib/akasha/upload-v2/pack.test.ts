import { describe, expect, it } from "vitest";

import {
    PACK_MEMBER_MAX,
    logicalBytesForPackProgress,
    packUploadUrl,
    partitionPackedUploads,
    payloadBytesFromXhr,
} from "./pack";

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

describe("logicalBytesForPackProgress", () => {
    const members = [
        { logicalSize: 100, payloadBytes: 50 },
        { logicalSize: 200, payloadBytes: 100 },
    ];

    it("credits nothing before any payload is sent", () => {
        expect(logicalBytesForPackProgress(members, 0)).toBe(0);
    });

    it("scales the current member from payload bytes to logical size", () => {
        expect(logicalBytesForPackProgress(members, 25)).toBe(50);
        expect(logicalBytesForPackProgress(members, 100)).toBe(200);
    });

    it("credits completed members in full", () => {
        expect(logicalBytesForPackProgress(members, 50)).toBe(100);
        expect(logicalBytesForPackProgress(members, 150)).toBe(300);
    });

    it("does not credit beyond the pack logical size", () => {
        expect(logicalBytesForPackProgress(members, 999)).toBe(300);
    });
});

describe("payloadBytesFromXhr", () => {
    it("stays at 0 while the form prefix is still uploading", () => {
        expect(payloadBytesFromXhr(80, 230, 150)).toBe(0);
    });

    it("counts only the payload after subtracting form overhead", () => {
        expect(payloadBytesFromXhr(130, 230, 150)).toBe(50);
        expect(payloadBytesFromXhr(230, 230, 150)).toBe(150);
    });

    it("does not exceed the payload size", () => {
        expect(payloadBytesFromXhr(400, 230, 150)).toBe(150);
    });
});
