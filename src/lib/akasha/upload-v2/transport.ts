import { parseHttpBody } from "@/lib/cbor-response";

import type { PersistedNteBundle, PersistedUploadIntent } from "./types";

import {
    DIRECT_UPLOAD_THRESHOLD,
    logicalBytesForPackProgress,
    packUploadUrl,
    payloadBytesFromXhr,
} from "./pack";

const PART_SIZE = 25 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 64;
const MAX_UPLOAD_FILE_SIZE = 1024 ** 3;
const RETRY_LIMIT = 3;
const COMPLETE_TIMEOUT_MS = 15 * 60 * 1000;

export interface IntentTransportCallbacks {
    onProgress?: (uploadedBytes: number, totalBytes: number) => void;
    onPartAcknowledged?: (index: number, totalParts: number) => Promise<void> | void;
    onPartsReset?: () => Promise<void> | void;
}

export interface IntentTransportResult {
    status: "completed" | "paused" | "failed";
    reason?: string;
}

export type PackMemberInput = {
    intent: PersistedUploadIntent;
    file: File;
    logicalSize: number;
    payloadBytes: number;
};

interface HttpResult {
    status: number;
    reason?: string;
    payload?: {
        status?: string;
        code?: string;
        results?: Array<{ intentId: string; status: string; reason?: string }>;
    };
}

export async function completeNteBundle(
    bundle: PersistedNteBundle,
    signal?: AbortSignal,
): Promise<IntentTransportResult> {
    const startedAt = Date.now();
    let transportFailures = 0;
    for (let attempt = 0; Date.now() - startedAt < COMPLETE_TIMEOUT_MS; attempt++) {
        const result = await request(bundle.completeUrl, {
            method: "POST",
            body: JSON.stringify({ token: bundle.token }),
            credentials: "include",
            headers: { "content-type": "application/json" },
            signal,
        });
        if (result.status >= 200 && result.status < 300 && result.status !== 202) {
            return { status: "completed" };
        }
        if (result.status === 202) {
            await retryDelay(
                Math.min(attempt, 4),
                signal,
                Math.min(30_000, COMPLETE_TIMEOUT_MS - (Date.now() - startedAt)),
            );
            continue;
        }
        if (!isRetryable(result) || transportFailures >= RETRY_LIMIT) {
            return {
                status: isRetryable(result) ? "paused" : "failed",
                reason: result.payload?.code ?? result.reason ?? `http_${result.status}`,
            };
        }
        transportFailures++;
        await retryDelay(Math.min(attempt, 4), signal, 30_000);
    }
    return { status: "paused", reason: "complete_timeout" };
}

export async function abortNteBundle(bundle: PersistedNteBundle, signal?: AbortSignal) {
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        const result = await request(bundle.abortUrl, {
            method: "POST",
            body: JSON.stringify({ token: bundle.token }),
            credentials: "include",
            headers: { "content-type": "application/json" },
            signal,
        });
        if (result.status >= 200 && result.status < 300) return result.payload?.status;
        if (!isRetryable(result) || attempt === RETRY_LIMIT) {
            throw new Error(result.payload?.code ?? result.reason ?? "bundle_cleanup_failed");
        }
        await retryDelay(attempt, signal);
    }
    throw new Error("bundle_cleanup_failed");
}

export async function uploadIntentBytes({
    intent,
    file,
    callbacks = {},
    signal,
}: {
    intent: PersistedUploadIntent;
    file: File;
    callbacks?: IntentTransportCallbacks;
    signal?: AbortSignal;
}): Promise<IntentTransportResult> {
    if (signal?.aborted) return { status: "paused", reason: "aborted" };
    if (file.size < DIRECT_UPLOAD_THRESHOLD) {
        return uploadDirect(intent, file, callbacks, signal);
    }
    return uploadParts(intent, file, callbacks, signal);
}

async function uploadDirect(
    intent: PersistedUploadIntent,
    file: File,
    callbacks: IntentTransportCallbacks,
    signal?: AbortSignal,
) {
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        const form = new FormData();
        form.append("token", intent.token);
        form.append("file", file);
        if (intent.compAlg) form.append("compAlg", intent.compAlg);
        if (intent.reverse) form.append("reverse", "true");

        const result = await sendXhr(intent.url, "POST", form, file.size, callbacks, signal);
        if (result.status >= 200 && result.status < 300 && result.status !== 202) {
            return { status: "completed" as const };
        }
        if (!isRetryable(result) || attempt === RETRY_LIMIT) {
            return {
                status: isRetryable(result) ? ("paused" as const) : ("failed" as const),
                reason: result.reason || `http_${result.status}`,
            };
        }
        await retryDelay(attempt, signal);
    }
    return { status: "paused" as const, reason: "retry_exhausted" };
}

export async function uploadPackBytes({
    members,
    callbacks = {},
    signal,
}: {
    members: PackMemberInput[];
    callbacks?: IntentTransportCallbacks;
    signal?: AbortSignal;
}): Promise<IntentTransportResult[]> {
    if (signal?.aborted) {
        return members.map(() => ({ status: "paused" as const, reason: "aborted" }));
    }
    const totalLogical = members.reduce((sum, member) => sum + member.logicalSize, 0);
    const manifest = JSON.stringify({
        entries: members.map((member) => ({
            intentId: member.intent.intentId,
            token: member.intent.token,
            sha256: member.intent.sha256,
            payloadBytes: member.payloadBytes,
            ...(member.intent.compAlg ? { compAlg: member.intent.compAlg } : {}),
        })),
    });
    const pack = new Blob(members.map((member) => member.file));

    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        const form = new FormData();
        form.append("manifest", manifest);
        form.append("pack", pack, "pack.bin");
        const result = await sendXhr(
            packUploadUrl(members[0].intent.url),
            "POST",
            form,
            pack.size,
            {
                onProgress: (uploadedPayload) => {
                    callbacks.onProgress?.(
                        logicalBytesForPackProgress(members, uploadedPayload),
                        totalLogical,
                    );
                },
            },
            signal,
        );
        if (result.status >= 200 && result.status < 300 && result.status !== 202) {
            const packResults = result.payload?.results;
            if (!packResults) {
                return members.map(() => ({
                    status: "failed" as const,
                    reason: result.reason || "pack_result_missing",
                }));
            }
            return members.map((member) => {
                const packResult = packResultForIntent(packResults, member.intent.intentId);
                if (!packResult) {
                    return { status: "failed" as const, reason: "pack_result_missing" };
                }
                if (packResult.status === "completed") return { status: "completed" as const };
                if (packResult.status === "pending") {
                    return { status: "paused" as const, reason: "pending" };
                }
                return {
                    status: "failed" as const,
                    reason: packResult.reason || packResult.status,
                };
            });
        }
        if (!isRetryable(result) || attempt === RETRY_LIMIT) {
            return members.map(() => ({
                status: isRetryable(result) ? ("paused" as const) : ("failed" as const),
                reason: result.reason || `http_${result.status}`,
            }));
        }
        try {
            await retryDelay(attempt, signal);
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return members.map(() => ({ status: "paused" as const, reason: "aborted" }));
            }
            throw error;
        }
    }
    return members.map(() => ({ status: "paused" as const, reason: "retry_exhausted" }));
}

async function uploadParts(
    intent: PersistedUploadIntent,
    file: File,
    callbacks: IntentTransportCallbacks,
    signal?: AbortSignal,
): Promise<IntentTransportResult> {
    const totalParts = Math.ceil(file.size / PART_SIZE);
    if (file.size > MAX_UPLOAD_FILE_SIZE || totalParts > MAX_MULTIPART_PARTS) {
        return { status: "failed" as const, reason: "file_too_large" };
    }
    const acknowledged = new Set(intent.acknowledgedParts);
    const sendMissingParts = async () => {
        for (let index = 0; index < totalParts; index++) {
            if (acknowledged.has(index)) continue;
            const part = file.slice(
                index * PART_SIZE,
                Math.min((index + 1) * PART_SIZE, file.size),
            );
            const result = await sendPart(intent, part, index, totalParts, signal);
            if (result.payload?.status === "completed") return { completed: true };
            if (result.status < 200 || result.status >= 300) return { result };
            acknowledged.add(index);
            await callbacks.onPartAcknowledged?.(index, totalParts);
            callbacks.onProgress?.(Math.min((index + 1) * PART_SIZE, file.size), file.size);
        }
        return { completed: false };
    };

    let sent = await sendMissingParts();
    if (sent.completed) return { status: "completed" };
    if (sent.result) return toTransportResult(sent.result);

    const startedAt = Date.now();
    let resetAfterMissingManifest = false;
    for (let attempt = 0; Date.now() - startedAt < COMPLETE_TIMEOUT_MS; attempt++) {
        const result = await completeIntent(intent, signal);
        if (result.status >= 200 && result.status < 300 && result.status !== 202) {
            return { status: "completed" };
        }
        if (
            !resetAfterMissingManifest &&
            (result.reason === "chunk_manifest_not_found" || result.reason === "chunks_incomplete")
        ) {
            resetAfterMissingManifest = true;
            acknowledged.clear();
            await callbacks.onPartsReset?.();
            sent = await sendMissingParts();
            if (sent.completed) return { status: "completed" };
            if (sent.result) return toTransportResult(sent.result);
            continue;
        }
        if (!isRetryable(result)) return toTransportResult(result);
        await retryDelay(Math.min(attempt, 4), signal, 30_000);
    }
    return { status: "paused", reason: "complete_timeout" };
}

async function sendPart(
    intent: PersistedUploadIntent,
    part: Blob,
    index: number,
    totalParts: number,
    signal?: AbortSignal,
) {
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
        const form = new FormData();
        form.append("token", intent.token);
        form.append("file", part);
        form.append("totalParts", totalParts.toString());
        const result = await request(`${intent.url}/parts/${index}`, {
            method: "PUT",
            body: form,
            credentials: "include",
            signal,
        });
        if (result.status >= 200 && result.status < 300) return result;
        if (!isRetryable(result) || attempt === RETRY_LIMIT) return result;
        await retryDelay(attempt, signal);
    }
    return { status: 0, reason: "network_error" };
}

async function completeIntent(intent: PersistedUploadIntent, signal?: AbortSignal) {
    return request(`${intent.url}/complete`, {
        method: "POST",
        body: JSON.stringify({
            token: intent.token,
            ...(intent.compAlg ? { compAlg: intent.compAlg } : {}),
            ...(intent.reverse ? { reverse: true } : {}),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        signal,
    });
}

function sendXhr(
    url: string,
    method: "POST",
    body: FormData,
    totalBytes: number,
    callbacks: IntentTransportCallbacks,
    signal?: AbortSignal,
) {
    return new Promise<HttpResult>((resolve) => {
        if (signal?.aborted) {
            resolve({ status: 0, reason: "aborted" });
            return;
        }
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        signal?.addEventListener("abort", abort, { once: true });
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                callbacks.onProgress?.(
                    payloadBytesFromXhr(event.loaded, event.total, totalBytes),
                    totalBytes,
                );
            }
        };
        xhr.onload = () => {
            signal?.removeEventListener("abort", abort);
            resolve(
                parseHttpBody(
                    xhr.status,
                    xhr.getResponseHeader("Content-Type"),
                    new Uint8Array(xhr.response as ArrayBuffer),
                ),
            );
        };
        xhr.onerror = () => resolve({ status: 0, reason: "network_error" });
        xhr.onabort = () => resolve({ status: 0, reason: "aborted" });
        xhr.responseType = "arraybuffer";
        xhr.withCredentials = true;
        xhr.open(method, url);
        xhr.send(body);
    });
}

async function request(url: string, init: RequestInit): Promise<HttpResult> {
    try {
        const response = await fetch(url, init);
        return parseHttpBody(
            response.status,
            response.headers.get("Content-Type"),
            new Uint8Array(await response.arrayBuffer()),
        );
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return { status: 0, reason: "aborted" };
        }
        return { status: 0, reason: "network_error" };
    }
}

function packResultForIntent(
    results: Array<{ intentId: string; status: string; reason?: string }>,
    intentId: string,
) {
    const matches = results.filter((result) => result.intentId === intentId);
    if (matches.length !== 1) return undefined;
    return matches[0];
}

function isRetryable(result: HttpResult) {
    return (
        result.status === 0 ||
        result.status === 202 ||
        result.status === 408 ||
        result.status === 429 ||
        result.status === 524 ||
        result.status >= 500
    );
}

function toTransportResult(result: HttpResult): IntentTransportResult {
    return {
        status: isRetryable(result) ? "paused" : "failed",
        reason: result.reason || `http_${result.status}`,
    };
}

function retryDelay(attempt: number, signal?: AbortSignal, cap = 8_000) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, Math.min(1000 * 2 ** attempt, cap));
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}
