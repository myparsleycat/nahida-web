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

export function formatUploadIssueDetail(
    issue: { outcome: "excluded" | "failed"; reason?: string },
    t: (key: string, options?: { defaultValue: string }) => string,
) {
    const status = t(
        issue.outcome === "excluded"
            ? "upload.transfer.status.denied"
            : "upload.transfer.status.failed",
    );
    if (!issue.reason) return status;
    return `${status} · ${t(`upload.transfer.reason.${issue.reason}`, { defaultValue: issue.reason })}`;
}
