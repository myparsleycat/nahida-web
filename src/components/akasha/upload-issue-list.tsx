import { useTranslation } from "react-i18next";

import type { PersistedUploadTarget } from "@/lib/akasha/upload-v2/types";

import { formatUploadIssueDetail } from "@/lib/akasha/upload-v2/format";
import { classifyUploadTarget } from "@/lib/akasha/upload-v2/policy";

export function UploadIssueList({ targets }: { targets: PersistedUploadTarget[] }) {
  const { t } = useTranslation();
  const issues = targets.flatMap((target) => {
    const outcome = classifyUploadTarget(target.status);
    if (outcome !== "failed" && outcome !== "excluded") return [];
    return [{ target, outcome }];
  });
  if (issues.length === 0) return null;

  return (
    <div className="max-h-32 w-full overflow-y-auto border bg-muted">
      <ul>
        {issues.map(({ target, outcome }) => (
          <li key={target.clientId} className="border-b px-2 py-1 last:border-b-0">
            <p className="truncate">{target.path || target.name}</p>
            <small className="text-muted-foreground">
              {formatUploadIssueDetail({ outcome, reason: target.reason }, t)}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
