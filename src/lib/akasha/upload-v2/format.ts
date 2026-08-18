export function formatUploadTransferSummary(
    summary: { failed: number; excluded: number },
    t: (key: string, options: { count: number }) => string,
) {
    return [
        summary.failed > 0 && t("upload.transfer.summary.failed", { count: summary.failed }),
        summary.excluded > 0 && t("upload.transfer.summary.excluded", { count: summary.excluded }),
    ]
        .filter(Boolean)
        .join(" · ");
}
