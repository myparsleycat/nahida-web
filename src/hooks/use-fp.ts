import { load } from "@fingerprintjs/fingerprintjs";
import { useEffect } from "react";

import { useGlobalStore } from "@/stores/global.store";

export function useFpHash() {
    const { fpHash, setFpHash } = useGlobalStore();

    useEffect(() => {
        if (!fpHash) {
            load()
                .then((r) => r.get())
                .then((r) => r.visitorId)
                .then((r) => setFpHash(r))
                .catch((error) => {
                    console.error("Failed to load fingerprint:", error);
                });
        }
    }, [fpHash]);
}
