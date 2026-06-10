import type { Content } from "@/lib/akasha/types";

import { eden } from "@/lib/eden";

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

export async function DeleteItem(items: Content[], sig?: string) {
    const ids = items.map((i) => i.id);

    const { error } = await eden.akasha.mod.item.delete({
        ids,
        sig,
    });

    if (error) {
        throw new Error(error.value.toString());
    }
}
