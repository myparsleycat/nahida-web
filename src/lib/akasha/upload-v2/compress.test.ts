/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/zstd", async () => {
    const { zstdCompressSync } = await import("node:zlib");
    return {
        default: {
            getInstance: async () => ({
                compress: (data: Uint8Array) => new Uint8Array(zstdCompressSync(data)),
            }),
        },
    };
});

import { DIRECT_UPLOAD_THRESHOLD } from "./pack";

import { prepareUploadFile, shouldSkipUploadCompression } from "./compress";

function textFile(name: string, contents: string) {
    return new File([contents], name);
}

function pngFile(size = 200) {
    const bytes = new Uint8Array(size);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return new File([bytes], "cover.png", { type: "image/png" });
}

function oversized(file: File, size: number) {
    Object.defineProperty(file, "size", { value: size });
    return file;
}

describe("prepareUploadFile", () => {
    it("compresses non-media files above the skip floor", async () => {
        const source = textFile("note.ini", "ini-payload-".repeat(20));
        const prepared = await prepareUploadFile(source);
        expect(prepared.compAlg).toBe("zstd");
        expect(prepared.file.size).not.toBe(source.size);
        expect(prepared.file.size).toBeGreaterThan(0);
    });

    it("does not compress images, videos, or small files", async () => {
        const image = await prepareUploadFile(pngFile());
        expect(image.compAlg).toBeUndefined();
        expect(image.file.size).toBe(200);

        const videoBytes = new Uint8Array(200);
        videoBytes.set([0x1a, 0x45, 0xdf, 0xa3]);
        const video = await prepareUploadFile(new File([videoBytes], "clip.webm", { type: "video/webm" }));
        expect(video.compAlg).toBeUndefined();

        const small = await prepareUploadFile(textFile("tiny.ini", "tiny"));
        expect(small.compAlg).toBeUndefined();
        expect(small.file.size).toBe(4);
    });

    it("compresses files at or over the multipart threshold", async () => {
        const source = oversized(textFile("huge.ini", "multipart-payload-".repeat(20)), DIRECT_UPLOAD_THRESHOLD);
        expect(await shouldSkipUploadCompression(source)).toBe(false);
        const prepared = await prepareUploadFile(source);
        expect(prepared.compAlg).toBe("zstd");
        expect(prepared.file.size).not.toBe(source.size);
    });

    it("compresses nte-named payloads", async () => {
        const source = textFile("Character.pak", "pak-payload-".repeat(20));
        const prepared = await prepareUploadFile(source);
        expect(prepared.compAlg).toBe("zstd");
        expect(prepared.file.size).not.toBe(source.size);
    });
});
