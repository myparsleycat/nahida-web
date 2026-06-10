import { fileTypeFromBlob } from "file-type";
import { decompress } from "fzstd";

export async function decompressData(base64String: string) {
    const binaryString = atob(base64String);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        compressedData[i] = binaryString.charCodeAt(i);
    }
    return decompress(compressedData);
}

export const reverseFileContent = async (file: File): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const reversedArray = uint8Array.slice().reverse();
    return new Blob([reversedArray], { type: file.type });
};

const isMediaByMagicNumbers = async (blob: Blob): Promise<boolean> => {
    const buffer = await blob.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const startsWith = (signature: number[]): boolean => {
        if (bytes.length < signature.length) return false;
        return signature.every((byte, index) => byte === bytes[index]);
    };

    const mediaSignatures = [
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
        [0x47, 0x49, 0x46, 0x38], // GIF
        [0xff, 0xd8, 0xff], // JPEG
        [0x42, 0x4d], // BMP
        [0x49, 0x49, 0x2a, 0x00], // TIFF (Little Endian)
        [0x4d, 0x4d, 0x00, 0x2a], // TIFF (Big Endian)
        [0x00, 0x00, 0x01, 0x00], // ICO
        [0x1a, 0x45, 0xdf, 0xa3], // WebM
    ];

    const isMP4 =
        bytes.length >= 8 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70;

    return mediaSignatures.some((sig) => startsWith(sig)) || isMP4;
};

export const isPreviewFile = async (file: File | Blob): Promise<boolean> => {
    if (file.size === 0) return false;

    const fileSlice = file.slice(0, 4100);

    try {
        const fileType = await fileTypeFromBlob(fileSlice);
        if (fileType)
            return fileType.mime.startsWith("image/") || fileType.mime.startsWith("video/");
    } catch {}

    if (await isMediaByMagicNumbers(file)) return true;

    const isByMimeType =
        file.type && (file.type.startsWith("image/") || file.type.startsWith("video/"));

    let isByName = false;
    if (file instanceof File && file.name) {
        isByName =
            /\.(gif|jpe?g|tiff?|png|webp|bmp|ico)$/i.test(file.name) ||
            /\.(mp4|webm|ogg|mov|avi|flv|mkv)$/i.test(file.name);
    }

    return isByMimeType || isByName;
};
