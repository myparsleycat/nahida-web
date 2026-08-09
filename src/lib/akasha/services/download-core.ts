import { encode } from "cbor-x";
import { t } from "i18next";
import ky from "ky";
import { toast } from "sonner";

import { DRIVE_URL } from "@/lib/const";
import { eden2url } from "@/lib/eden";

import type { OpfsDirInfo, OpfsFileInfo } from "./opfs-download";

import sseWorker from "./sse.worker?worker";

export interface StreamedMetadata {
    root: OpfsDirInfo;
    totalBytes: number;
    files: OpfsFileInfo[];
    dirs: OpfsDirInfo[];
    mtd: {
        type: string;
        [key: string]: string | number;
    } | null;
}

export function startStreamingDownload(params: {
    url: string;
    headers?: Record<string, string>;
    abortSignal: AbortSignal;
}) {
    const { url, headers, abortSignal } = params;
    const worker = new sseWorker();

    return new Promise<StreamedMetadata>((resolve, reject) => {
        const downloadData = {
            totalBytes: 0,
            files: [] as OpfsFileInfo[],
            dirs: [] as OpfsDirInfo[],
        };
        let rootDir: OpfsDirInfo | null = null;
        let mtd: StreamedMetadata["mtd"] = null;

        const onAbort = () => {
            abortSignal.removeEventListener("abort", onAbort);
            try {
                worker.postMessage({ type: "abort" });
            } catch {}
            worker.terminate();
            const error = new Error("Download aborted");
            error.name = "AbortError";
            reject(error);
        };

        if (abortSignal.aborted) {
            onAbort();
            return;
        }

        abortSignal.addEventListener("abort", onAbort, { once: true });

        worker.onmessage = (event) => {
            const { type, payload } = event.data;

            switch (type) {
                case "dirs":
                    downloadData.dirs.push(...payload);
                    break;
                case "files":
                    downloadData.files.push(...payload);
                    break;
                case "metadata":
                    downloadData.totalBytes = payload.totalBytes;
                    rootDir = payload.root;
                    mtd = payload.mtd;
                    break;
                case "complete":
                    worker.terminate();
                    abortSignal.removeEventListener("abort", onAbort);
                    if (!rootDir) {
                        reject(new Error("Root directory information was not received."));
                        return;
                    }
                    resolve({
                        root: rootDir,
                        totalBytes: downloadData.totalBytes,
                        files: downloadData.files,
                        dirs: [rootDir, ...downloadData.dirs],
                        mtd,
                    });
                    break;
                case "error":
                    worker.terminate();
                    abortSignal.removeEventListener("abort", onAbort);
                    reject(new Error(payload || "An unknown worker error occurred"));
                    break;
            }
        };

        worker.onerror = (error) => {
            console.error("Worker error:", error);
            worker.terminate();
            abortSignal.removeEventListener("abort", onAbort);
            reject(error);
        };

        worker.postMessage({
            url: url.toString(),
            headers,
        });
    });
}

export function getDriveDownloadUrl(params: { uuid: string; linkId?: string }) {
    const { uuid, linkId } = params;
    return eden2url.akasha.dir.download
        .url({
            query: {
                uuid,
                ...(linkId ? { linkId } : {}),
            },
        })
        .toString();
}

export function getModDownloadUrl(params: { itemId: string }) {
    return eden2url.akasha.mod.download({ itemId: params.itemId }).url().toString();
}

export function buildDriveSseHeaders(params: { token?: string }) {
    const headers: Record<string, string> = {};
    if (params.token) {
        headers["nhd-link-token"] = params.token;
    }
    return headers;
}

export function buildModSseHeaders(params: {
    fpHash: string | null;
    token?: string;
    sig?: string;
}) {
    const headers: Record<string, string> = {};
    if (params.fpHash) {
        headers["X-FPH"] = params.fpHash;
    }
    if (params.token) {
        headers["x-token"] = params.token;
    }
    if (params.sig) {
        headers["x-sig"] = params.sig;
    }
    return headers;
}

export async function startDesktopDownload(params: {
    type: "live";
    id: string;
    data: any;
    suggestedName?: string;
    link?: { linkId: string; token: string };
    minVersion: string;
}) {
    const { type, id, data, suggestedName, link, minVersion } = params;

    try {
        await ky.get(DRIVE_URL + "/ping", {
            timeout: 500,
            retry: { limit: 0 },
        });

        const versionResp = await ky.get(DRIVE_URL + "/version", {
            timeout: 500,
            retry: { limit: 0 },
            throwHttpErrors: false,
        });

        if (!versionResp.ok) {
            toast.warning(t("toast.desktop_version_to_low.title"), {
                description: t("toast.desktop_version_to_low.description"),
            });
            return;
        }

        const version = await versionResp.text();

        if (semverCompare(version, minVersion) < 0) {
            toast.warning(t("toast.desktop_version_to_low.title"), {
                description: t("toast.desktop_version_to_low.description"),
            });
            return;
        }

        const payload: any = { type, id, suggestedName };
        if (data !== undefined) payload.data = data;
        if (link) payload.link = link;

        const encodedData = encode(payload);

        const ws = new WebSocket(DRIVE_URL + "/ws");

        ws.onopen = () => {
            ws.send(encodedData as any);
        };

        ws.onmessage = (event) => {
            switch (event.data) {
                case "invalid data":
                    toast.error(t("toast.desktop_invalid_data"));
                    break;
                case "download started":
                    toast.success(t("toast.desktop_download_started"));
                    break;
                case "download canceled":
                    toast.warning(t("toast.desktop_canceled"));
                    break;
                case "download error":
                    toast.error("Download Error");
                    break;
                case "unauthorized":
                    toast.warning(t("toast.desktop_required_login"));
                    break;
            }
            ws.close();
        };

        ws.onerror = (error) => {
            console.error("websocket error:", error);
            ws.close();
        };
    } catch {
        toast.warning(t("toast.desktop_failed"));
    }
}

export function semverCompare(a: string, b: string): number {
    const parse = (v: string) => v.split(".").map(Number);
    const [a1, a2, a3] = parse(a);
    const [b1, b2, b3] = parse(b);

    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 - b2;
    return (a3 || 0) - (b3 || 0);
}
