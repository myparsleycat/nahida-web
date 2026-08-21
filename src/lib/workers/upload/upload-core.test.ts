/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/eden", () => ({
    eden2url: {
        akasha: {
            file: {
                upload: {
                    url: () => "https://example.test/upload",
                },
            },
        },
    },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/utils")>();
    return {
        ...actual,
        compressData: vi.fn(async () => ({ compressedData: null, isCompressed: false })),
    };
});

vi.mock("@/lib/akasha/services/drive-common", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/akasha/services/drive-common")>();
    return {
        ...actual,
        reverseFileContent: vi.fn(),
    };
});

import { createUploadCore } from "./upload-core";

describe("createUploadCore compression failures", () => {
    it("resolves the legacy worker upload when compression fails", async () => {
        const send = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => {});
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        const { performParallelUploads } = createUploadCore({
            compAlg: "zstd",
            updateProgress: vi.fn(),
        });
        const source = new File(["payload-".repeat(40)], "note.ini");
        const uploaded: string[] = [];

        const completed = await performParallelUploads(
            [
                {
                    FID: "file-1",
                    name: "note.ini",
                    status: "pending",
                    size: source.size,
                    file: {
                        FID: "file-1",
                        clientId: "file-1",
                        path: "note.ini",
                        name: "note.ini",
                        size: source.size,
                        parentPath: "",
                        parentId: "parent",
                        file: source,
                    },
                    form: {
                        parentId: "parent",
                        sha256: "a".repeat(64),
                        name: "note.ini",
                        key: "key",
                    },
                },
            ],
            (fid) => uploaded.push(fid),
        );

        expect(completed).toEqual([]);
        expect(uploaded).toEqual([]);
        expect(send).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledWith("파일 압축 중 오류:", "compression_failed");
        send.mockRestore();
        logged.mockRestore();
    });
});
