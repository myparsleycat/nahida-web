import type { PersistedUploadIntent } from "./types";

const DIRECT_UPLOAD_THRESHOLD = 80 * 1024 * 1024;
const PART_SIZE = 25 * 1024 * 1024;
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

interface HttpResult {
    status: number;
    reason?: string;
    payload?: { status?: string };
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

async function uploadParts(
    intent: PersistedUploadIntent,
    file: File,
    callbacks: IntentTransportCallbacks,
    signal?: AbortSignal,
): Promise<IntentTransportResult> {
    const totalParts = Math.ceil(file.size / PART_SIZE);
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
            if (event.lengthComputable) callbacks.onProgress?.(event.loaded, totalBytes);
        };
        xhr.onload = () => {
            signal?.removeEventListener("abort", abort);
            resolve(parseHttpResult(xhr.status, xhr.responseText));
        };
        xhr.onerror = () => resolve({ status: 0, reason: "network_error" });
        xhr.onabort = () => resolve({ status: 0, reason: "aborted" });
        xhr.withCredentials = true;
        xhr.open(method, url);
        xhr.send(body);
    });
}

async function request(url: string, init: RequestInit): Promise<HttpResult> {
    try {
        const response = await fetch(url, init);
        return parseHttpResult(response.status, await response.text());
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return { status: 0, reason: "aborted" };
        }
        return { status: 0, reason: "network_error" };
    }
}

function parseHttpResult(status: number, raw: string): HttpResult {
    if (!raw) return { status };
    try {
        const value: unknown = JSON.parse(raw);
        if (typeof value === "string") return { status, reason: value };
        if (value && typeof value === "object") {
            const payload = value as { status?: string; reason?: string; message?: string };
            return { status, payload, reason: payload.reason || payload.message };
        }
    } catch {
        return { status, reason: raw.slice(0, 200) };
    }
    return { status };
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
