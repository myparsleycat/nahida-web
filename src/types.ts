export type ModImage = {
    filename: string | null;
    md5: string | null;
    size: number | null;
    height: number | null;
    width: number | null;
    ext: string | null;
    created_at: number | null;
    url: string | null;
};

export type VirusTotal = {
    malicious: number;
    suspicious: number;
    undetected: number;
    harmless: number;
    timeout: number;
    "confirmed-timeout": number;
    failure: number;
    "type-unsupported": number;
} | null;

export type Modder = {
    id: string;
    // name: string | null;
    // credId: string | null;
    // email: string | null;
    // image: string | null;
} | null;

export type ModData = {
    uuid: string;
    modder: Modder;
    version: string;
    password: boolean;
    game: string;
    title: string;
    description: string | null;
    tags: string[];
    imgs: ModImage[];
    dl_count: number;
    merged: boolean;
    swapkey: unknown | null;
    preview_url: string;
    arca_url: string | null;
    virustotal_url: string | null;
    vt_data: VirusTotal;
    sha256: string;
    size: number;
    unzip_size: number;
    uploaded_at: number;
    expires_at: number | null;
    expired: boolean;
    status: string | null;
    vv: number;
    c_status: {
        expires_at: number | null;
        is_active: boolean;
        is_deleted?: boolean;
    };
};

export type FileTreeType = {
    id: number;
    name: string;
    path?: string;
    isFolder: boolean;
    fileHash: string | null;
    fileExtension: string | null;
    mimeType: string | null;
    fileSize: number | null;
    createdAt: number;
    updatedAt: number;
    children: FileTreeType[];
};

export type LogEntry = {
    id: number;
    timestamp: string;
    level: "ERROR" | "WARNING" | "INFO" | "SUCCESS";
    message: string;
    details?: string;
};

export type filesT = {
    uuid: string;
    parentId: string | null;
    name: string;
    size: number;
    compAlg: "gzip" | "zstd" | null;
    url: string | null;
};

export type dirsT = {
    uuid: string;
    parentId: string | null;
    name: string;
};
