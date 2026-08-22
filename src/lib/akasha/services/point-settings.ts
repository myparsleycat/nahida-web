import { useQuery } from "@tanstack/react-query";

import { eden } from "@/lib/eden";

export const pointSettingsQueryKey = ["public:point-settings"] as const;

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
