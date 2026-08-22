import type { AkashaMod } from "@/context/ModContext";

export function isModOwner(mod: AkashaMod | null | undefined) {
    return !!mod?.permission.own || !!mod?.permission.sig;
}

export function collectionNeedsPayment(mod: AkashaMod | null | undefined, collectionId: string) {
    if (!mod || isModOwner(mod)) return false;
    if (!mod.points || mod.points.scope === "none") return false;
    if (mod.points.scope === "mod") return !mod.points.paid;
    const collection = mod.collections.find((item) => item.id === collectionId);
    if (!collection || collection.pointAmount == null) return false;
    return !collection.paid;
}

export function requiredPointAmount(mod: AkashaMod | null | undefined, collectionId: string) {
    if (!mod?.points) return null;
    if (mod.points.scope === "mod") return mod.points.amount;
    if (mod.points.scope === "collection") {
        return mod.collections.find((item) => item.id === collectionId)?.pointAmount ?? null;
    }
    return null;
}

export function parsePointAmountInput(
    value: string,
    range: { min: number; max: number },
): number | null | "invalid" {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const amount = Number(trimmed);
    if (!Number.isInteger(amount) || amount < range.min || amount > range.max) {
        return "invalid";
    }
    return amount;
}
