export function normalizePath(path: string) {
    return path.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
}

export function validateExt(name: string, additionalExt: string[] = []) {
    const defaultAllowedExt = [
        ".buf",
        ".ib",
        ".vb",
        ".dds",
        ".ini",
        ".jpeg",
        ".jpg",
        ".png",
        ".webp",
        ".gif",
        ".avif",
        ".avifs",
        ".bmp",
        ".hlsl",
        ".py",
        ".json",
        ".txt",
        ".pmx",
        ".tga",
        ".spa",
        ".assets",
        ".wem",
        ".mp4",
        ".webm",
        ".blend",
        ".pck",
    ];

    const allowedExt = defaultAllowedExt.concat(additionalExt);

    return allowedExt.some((ext) => name.toLowerCase().endsWith(ext));
}
