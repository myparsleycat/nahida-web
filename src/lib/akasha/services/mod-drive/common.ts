import type { Content } from "@/lib/akasha/types";

import {
    deleteModItems,
    requireBatchAccepted,
    type BatchDeletionOutcome,
} from "@/lib/akasha/services/deletion";

export function parseModPath(pathname: string) {
    const cleanedPath = pathname.replace(/^\/+|\/+$/g, "");

    if (!cleanedPath) {
        return {
            modId: "",
            collectionId: "",
            intermediateItemIds: [],
            itemId: "",
        };
    }

    const segments = cleanedPath.split("/");

    const modId = segments[0] || "";
    const collectionId = segments[1] || "";

    const itemSegments = segments.slice(2);
    const itemId = itemSegments.pop() || "";
    const intermediateItemIds = itemSegments;

    return {
        modId,
        collectionId,
        intermediateItemIds,
        itemId,
    };
}

export async function DeleteItem(items: Content[], sig?: string): Promise<BatchDeletionOutcome> {
    return requireBatchAccepted(
        await deleteModItems(
            items.map((item) => item.id),
            sig,
        ),
    );
}
