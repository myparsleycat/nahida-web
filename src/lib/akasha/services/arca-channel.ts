export const ARCA_CHANNEL_IDS = ["genshinskinmode", "thingzyoa"] as const;
export type ArcaChannel = (typeof ARCA_CHANNEL_IDS)[number];

export function isArcaChannel(value: unknown): value is ArcaChannel {
    return value === "genshinskinmode" || value === "thingzyoa";
}
