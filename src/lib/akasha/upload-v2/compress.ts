import { compressData } from "@/lib/utils";

import { isPreviewFile } from "../services/drive-common";

export const SKIP_COMPRESSION_MAX_BYTES = 100;

export async function shouldSkipUploadCompression(file: File | Blob): Promise<boolean> {
    if (file.size <= SKIP_COMPRESSION_MAX_BYTES) return true;
    return isPreviewFile(file);
}

export async function prepareUploadFile(source: File): Promise<{
    file: File;
    compAlg?: "zstd";
}> {
    if (await shouldSkipUploadCompression(source)) {
        return { file: source };
    }
    const compressed = await compressData(await source.arrayBuffer(), "zstd");
    if (!compressed.isCompressed || !compressed.compressedData) {
        throw new Error("compression_failed");
    }
    return {
        file: new File(
            [new Uint8Array(compressed.compressedData).slice().buffer],
            source.name,
        ),
        compAlg: "zstd",
    };
}
