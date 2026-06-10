import type { Content } from "@/lib/akasha/types";

import { startDesktopDownload } from "./download-core";

interface StartDownloadForDesktopProps {
    item: Content;
    suggestedName?: string;
    link?: {
        linkId: string;
        token: string;
    };
}

export async function startAkashaDownloadForDesktop(props: StartDownloadForDesktopProps) {
    const { item, suggestedName, link } = props;

    await startDesktopDownload({
        type: "live",
        id: item.id.toString() || "",
        data: undefined,
        suggestedName: suggestedName || item.name,
        link,
        minVersion: "2.21.0",
    });
}
