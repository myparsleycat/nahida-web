import { useQuery } from "@tanstack/react-query";

import { ARCA_CHANNEL_IDS, type ArcaChannel } from "./arca-channel";
import { eden } from "@/lib/eden";

export const pointSettingsQueryKey = ["public:point-settings"] as const;

export type PointSettingsData = {
    point_amount_min: Record<ArcaChannel, number>;
    point_amount_max: Record<ArcaChannel, number>;
    point_withdraw_min: Record<ArcaChannel, number>;
    point_withdraw_fee_percent: Record<ArcaChannel, number>;
};

export type PointAmountRange = { min: number; max: number };

export async function fetchPointSettings() {
    const { data, error } = await eden.public["point-settings"].get();
    if (error) throw new Error(String(error.value));
    return data;
}

export function usePointSettings() {
    return useQuery({
        queryKey: pointSettingsQueryKey,
        queryFn: fetchPointSettings,
    });
}

export function pointAmountRanges(
    settings: Pick<PointSettingsData, "point_amount_min" | "point_amount_max">,
): Record<ArcaChannel, PointAmountRange> {
    return Object.fromEntries(
        ARCA_CHANNEL_IDS.map((id) => [
            id,
            { min: settings.point_amount_min[id], max: settings.point_amount_max[id] },
        ]),
    ) as Record<ArcaChannel, PointAmountRange>;
}