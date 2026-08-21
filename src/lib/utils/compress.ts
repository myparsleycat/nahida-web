import { fileTypeFromBuffer } from "file-type";
import * as fzstd from "fzstd";

import ZstdWasm from "@/lib/zstd";

export async function gzipcomp(data: ArrayBuffer) {
    const blob = new Blob([data]);
    const compressedStream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(compressedStream).arrayBuffer());
}

export const compressData = async (
    data: ArrayBuffer,
    algorithm: string,
): Promise<{ compressedData: Uint8Array | null; isCompressed: boolean }> => {
    try {
        if (data.byteLength <= 100) {
            return { compressedData: null, isCompressed: false };
        }

        const fileType = await fileTypeFromBuffer(data);

        if (fileType?.mime.startsWith("image/") || fileType?.mime.startsWith("video/")) {
            return { compressedData: null, isCompressed: false };
        }

        let compressedData: Uint8Array;
        switch (algorithm) {
            case "gzip":
                compressedData = await gzipcomp(data);
                break;
            case "zstd":
                const zstd = await ZstdWasm.getInstance();
                compressedData = zstd.compress(new Uint8Array(data), 6);
                break;
            default:
                throw new Error("올바르지 않은 압축 알고리즘");
        }

        return { compressedData, isCompressed: true };
    } catch (err: any) {
        console.error("compressData Error", err.message);
        return { compressedData: null, isCompressed: false };
    }
};

export async function gunzip(data: ArrayBuffer) {
    const blob = new Blob([data]);
    const decompStream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(decompStream).arrayBuffer());
}

export async function Decompressor(data: Uint8Array, alg: "zstd" | "gzip") {
    let arrbuf: Uint8Array;

    if (alg === "gzip") {
        arrbuf = await gunzip(data.buffer as ArrayBuffer);
    } else if (alg === "zstd") {
        arrbuf = fzstd.decompress(data);
    } else {
        throw new Error("Invalid alg");
    }

    return arrbuf;
}
