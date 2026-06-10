import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export { formatSize, formatDate } from "./utils/format";
export { calculateFileSha256 } from "./utils/crypto";
export { gzipcomp, compressData, gunzip, Decompressor } from "./utils/compress";
export { TypedStorage } from "./utils/storage";
export { normalizePath, validateExt } from "./utils/validate";
export {
    getRandInt,
    getRandFloat,
    copyStr,
    getImageFromClipboard,
    base64url,
    commonSort,
} from "./utils/misc";
