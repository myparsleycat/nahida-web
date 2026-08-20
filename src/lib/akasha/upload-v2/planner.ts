import { eden } from "@/lib/eden";

import type {
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadPlanEntry,
    UploadPlanItem,
    UploadPlanNteBundle,
    UploadPlanResponse,
} from "./types";

const PLAN_PAGE_SIZE = 500;
export const NTE_BUNDLE_CAPABILITY = "nte-bundle-v1" as const;

export async function planUploadSession(
    session: PersistedUploadSession,
    targets: PersistedUploadTarget[],
) {
    const items: UploadPlanItem[] = [];
    const uploads = new Map<string, UploadPlanEntry>();
    const nteBundles = new Map<string, UploadPlanNteBundle>();

    for (const page of paginateUploadTargets(targets)) {
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
                      capabilities: [NTE_BUNDLE_CAPABILITY],
                      files,
                  })
                : await eden.akasha.v2.mod
                      .collections({ collectionId: session.collectionId! })
                      ["files:plan"].post({
                          requestId: session.requestId,
                          sig: session.sig,
                          capabilities: [NTE_BUNDLE_CAPABILITY],
                          files,
                      });

        if (result.error) throw new Error(toErrorMessage(result.error.value));
        const data = result.data as UploadPlanResponse;
        items.push(...data.items);
        for (const upload of data.uploads) uploads.set(upload.intentId, upload);
        for (const bundle of data.nteBundles ?? []) nteBundles.set(bundle.id, bundle);
    }

    return {
        requestId: session.requestId,
        items,
        uploads: [...uploads.values()],
        nteBundles: [...nteBundles.values()],
    };
}

export function paginateUploadTargets(targets: PersistedUploadTarget[]) {
    const nteGroups = new Map<string, PersistedUploadTarget[]>();
    const units: PersistedUploadTarget[][] = [];

    for (const target of targets) {
        const basename = getNteBasename(target.name);
        if (!basename) {
            units.push([target]);
            continue;
        }
        const key = `${target.parentId ?? ""}\0${basename}`;
        const group = nteGroups.get(key);
        if (group) {
            group.push(target);
            continue;
        }
        const created = [target];
        nteGroups.set(key, created);
        units.push(created);
    }

    const pages: PersistedUploadTarget[][] = [];
    let current: PersistedUploadTarget[] = [];
    for (const unit of units) {
        if (unit.length > PLAN_PAGE_SIZE) throw new Error("nte_bundle_too_large");
        if (current.length + unit.length > PLAN_PAGE_SIZE) {
            pages.push(current);
            current = [];
        }
        current.push(...unit);
    }
    if (current.length > 0) pages.push(current);
    return pages;
}

function getNteBasename(name: string) {
    const match = /^(.*)\.(pak|utoc|ucas)$/i.exec(name);
    if (!match) return undefined;
    const stem =
        match[2].toLowerCase() === "ucas" ? match[1].replace(/_s[1-9]\d*$/i, "") : match[1];
    return stem.normalize("NFC").toLowerCase();
}

function toErrorMessage(value: unknown) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) {
        return String(value.message);
    }
    return "upload_plan_failed";
}
