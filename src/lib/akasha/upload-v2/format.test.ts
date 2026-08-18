import { describe, expect, it } from "vitest";

import { formatUploadIssueDetail, formatUploadTransferSummary } from "./format";

const t = (key: string, options?: { count?: number; defaultValue?: string }) =>
    options?.defaultValue ?? (options?.count !== undefined ? `${key}:${options.count}` : key);

describe("formatUploadIssueDetail", () => {
    it("labels excluded and failed from the classifier outcome", () => {
        expect(formatUploadIssueDetail({ outcome: "excluded" }, t)).toBe(
            "upload.transfer.status.denied",
        );
        expect(formatUploadIssueDetail({ outcome: "failed" }, t)).toBe(
            "upload.transfer.status.failed",
        );
    });

    it("appends a localized reason when one is present", () => {
        expect(
            formatUploadIssueDetail({ outcome: "excluded", reason: "unsupported_file_type" }, t),
        ).toBe("upload.transfer.status.denied · unsupported_file_type");
        expect(formatUploadIssueDetail({ outcome: "failed", reason: "http_503" }, t)).toBe(
            "upload.transfer.status.failed · http_503",
        );
    });
});

describe("formatUploadTransferSummary", () => {
    it("joins failed and excluded counts", () => {
        expect(formatUploadTransferSummary({ failed: 1, excluded: 2 }, t)).toBe(
            "upload.transfer.summary.failed:1 · upload.transfer.summary.excluded:2",
        );
    });
});
