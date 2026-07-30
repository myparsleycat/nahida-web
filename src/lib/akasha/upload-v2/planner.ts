import { chunk } from "es-toolkit";

import { eden } from "@/lib/eden";

import type {
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadPlanEntry,
    UploadPlanItem,
} from "./types";

export async function planUploadSession(
    session: PersistedUploadSession,
    targets: PersistedUploadTarget[],
) {
    const items: UploadPlanItem[] = [];
    const uploads = new Map<string, UploadPlanEntry>();

    for (const page of chunk(targets, 500)) {
        const files = page.map((target) => {
            if (!target.sha256 || !target.parentId) {
                throw new Error("upload_target_not_ready");
            }
            return {
                clientId: target.clientId,
                name: target.name,
                sha256: target.sha256,
                size: target.size,
                parentId: target.parentId,
                path: target.path,
            };
        });
        const result =
            session.kind === "drive"
                ? await eden.akasha.v2.drive["files:plan"].post({
                      requestId: session.requestId,
                      current: session.current,
                      files,
                  })
                : await eden.akasha.v2.mod
                      .collections({ collectionId: session.collectionId! })
                      ["files:plan"].post({
                          requestId: session.requestId,
                          sig: session.sig,
                          files,
                      });

        if (result.error) throw new Error(toErrorMessage(result.error.value));
        items.push(...result.data.items);
        for (const upload of result.data.uploads) uploads.set(upload.intentId, upload);
    }

    return { requestId: session.requestId, items, uploads: [...uploads.values()] };
}

function toErrorMessage(value: unknown) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) {
        return String(value.message);
    }
    return "upload_plan_failed";
}
