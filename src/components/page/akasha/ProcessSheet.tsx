import {
  ArrowsVertical as ArrowUpDownIcon,
  AvatarCircleX as CircleXIcon,
  Download as DownloadIcon,
  File as FileIcon,
  Folder as FolderIcon,
  Loader as Loader2Icon,
  Loader as LoaderIcon,
} from "pixelarticons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { UploadIssueList } from "@/components/akasha/upload-issue-list";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { akasha, useAkashaStore, type CurrentProcess } from "@/lib/akasha";
import { formatUploadTransferSummary } from "@/lib/akasha/upload-v2/format";
import {
  getUploadSessionActionAvailability,
  summarizeUploadTargets,
} from "@/lib/akasha/upload-v2/policy";
import { cn, formatSize } from "@/lib/utils";
import { useUploadSessionStore } from "@/stores/akasha-upload-session.store";

import { sheetTriggerClass } from "./DriveLayout";

interface ProcessSheetProps {
  children?: React.ReactNode;
  variants?: "default" | "outline" | "ghost";
}

function getProgressMessage(process: CurrentProcess): string {
  switch (process.status) {
    case "creating-directory":
      return `디렉토리 생성중 (${process.processedItems}/${process.totalItems})`;
    case "hash-calculation":
      return `해시 계산중 (${process.processedItems}/${process.totalItems})`;
    case "uploading":
      return `업로드중 (${process.processedItems}/${process.totalItems})`;
    case "paused":
      return "일시정지됨";
    case "completed":
      return "완료됨";
    case "failed":
      return `실패: ${process.error || "알 수 없는 오류"}`;
    default:
      return "대기중";
  }
}

function PersistentUploadSessions() {
  const uploads = useUploadSessionStore();
  const { t } = useTranslation();

  return Object.values(uploads.snapshots).map((snapshot) => {
    const summary = summarizeUploadTargets(snapshot.targets);
    const outcome = formatUploadTransferSummary(summary, t);
    const progress = summary.total
      ? ((summary.completed + summary.excluded) / summary.total) * 100
      : snapshot.session.status === "completed"
        ? 100
        : 0;
    const actions = getUploadSessionActionAvailability(snapshot);
    const runAction = (action: () => Promise<void>) =>
      action().catch((error) => {
        toast.error(t("upload.transfer.action_error"), {
          description: error instanceof Error ? error.message : String(error),
        });
      });

    return (
      <section key={snapshot.session.requestId} className="flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex aspect-square w-10 shrink-0 items-center justify-center bg-secondary p-1">
              {snapshot.session.directories.length > 0 ? (
                <FolderIcon className="h-6 w-6" />
              ) : (
                <FileIcon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate">{snapshot.session.name}</p>
              <small className="text-muted-foreground">
                {formatSize(snapshot.session.totalBytes)} · {summary.completed}/{summary.total}
                {outcome ? ` · ${outcome}` : ""}
              </small>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {actions.canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClickPromise={() => runAction(() => uploads.retry(snapshot.session.requestId))}
              >
                {t("upload.transfer.action.retry")}
              </Button>
            )}
            {actions.canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClickPromise={() => runAction(() => uploads.dismiss(snapshot.session.requestId))}
              >
                {t("upload.transfer.action.cancel")}
              </Button>
            )}
            {actions.canDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClickPromise={() => runAction(() => uploads.dismiss(snapshot.session.requestId))}
              >
                {t("upload.transfer.action.dismiss")}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-3 text-muted-foreground">
            <small>
              {t(`upload.transfer.status.${snapshot.session.status}`, {
                defaultValue: snapshot.session.status,
              })}
            </small>
            <small>{Math.round(progress)}%</small>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
        <UploadIssueList targets={snapshot.targets} />
      </section>
    );
  });
}

export function ProcessSheet(props: ProcessSheetProps) {
  const { children, variants } = props;

  const { sheetOpen, setSheetOpen, upload, download } = useAkashaStore();
  const persistentUploads = useUploadSessionStore();
  const { t } = useTranslation();

  const uploads = upload.queue.length + (upload.current ? 1 : 0);
  const downloads = download.queue.length + (download.current ? 1 : 0);
  const persistentSnapshots = Object.values(persistentUploads.snapshots);
  const activePersistent = persistentSnapshots.filter(
    (snapshot) => !["completed", "partial", "cancelled"].includes(snapshot.session.status),
  ).length;
  const active = uploads + downloads + activePersistent;
  const total = uploads + downloads + persistentSnapshots.length;

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      {children ? (
        <SheetTrigger asChild>{children}</SheetTrigger>
      ) : variants ? (
        <SheetTrigger className={sheetTriggerClass}>
          {active ? (
            <Loader2Icon className="h-full w-full animate-spin" />
          ) : (
            <ArrowUpDownIcon className="h-full w-full" />
          )}
        </SheetTrigger>
      ) : (
        <SheetTrigger className={sheetTriggerClass}>
          {active ? (
            <Loader2Icon className="h-full w-full animate-spin" />
          ) : (
            <ArrowUpDownIcon className="h-full w-full" />
          )}
        </SheetTrigger>
      )}

      <SheetContent className="h-full" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>
            {t("drive.ui.transfers")} ({total})
          </SheetTitle>
          <div className="flex grow">
            <div className="flex max-h-[70vh] w-full flex-col gap-4 overflow-y-auto">
              <PersistentUploadSessions />

              {upload.current && (
                <div className="flex w-full flex-col gap-2 border-b pb-4 last:border-b-0">
                  <div className="flex w-full flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="flex aspect-square w-10 items-center justify-center rounded-md bg-secondary p-1">
                        {upload.current.directories && upload.current.directories.length > 0 ? (
                          <FolderIcon className="h-6 w-6 shrink-0 object-cover" />
                        ) : (
                          <FileIcon className="h-6 w-6 shrink-0 object-cover" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="line-clamp-1 break-all text-ellipsis">
                          {upload.current.name}
                        </p>
                        <p className="line-clamp-1 text-xs break-all text-ellipsis text-muted-foreground">
                          {formatSize(upload.current.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-1">
                      <div className="inline-flex items-center gap-2 rounded-sm border border-transparent bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                        <LoaderIcon className="animate-spin" width={12} height={12} />
                        {getProgressMessage(upload.current)}
                      </div>
                    </div>
                  </div>

                  {upload.current.status === "uploading" &&
                    upload.current.totalBytes !== undefined && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span></span>
                          <span>{formatSize(upload.current.uploadBytesPerSec)}/s</span>
                        </div>
                      </div>
                    )}

                  {upload.current.error && (
                    <p className="text-sm text-destructive">{upload.current.error}</p>
                  )}
                </div>
              )}

              {download.current && (
                <div className="flex w-full flex-col gap-2 border-b pb-4 last:border-b-0">
                  <div className="flex w-full flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="flex aspect-square w-10 items-center justify-center rounded-md bg-secondary">
                        <button
                          type="button"
                          aria-label={t("upload.transfer.action.cancel")}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => {
                            if (download.current) {
                              akasha.DLProcess.CancelDownload(download.current.pid);
                            } else {
                              toast.warning(
                                "현재 중지하려는 다운로드가 current 상태에 있지 않습니다",
                              );
                            }
                          }}
                        >
                          <CircleXIcon />
                        </button>
                      </div>
                      <div className="flex flex-col">
                        <p className="line-clamp-1 break-all text-ellipsis">
                          {download.current.name}
                        </p>
                        <p className="line-clamp-1 text-xs break-all text-ellipsis text-muted-foreground">
                          {formatSize(download.current.totalSize)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-1">
                      <div className="inline-flex items-center gap-2 rounded-sm border border-transparent bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                        <LoaderIcon className="animate-spin" width={12} height={12} />
                        {formatSize(download.current.downloadedSize)}/
                        {formatSize(download.current.totalSize)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Progress value={download.current.progress} className="h-1" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span></span>
                      {download.current.downloadBytesPerSec && (
                        <span>{formatSize(download.current.downloadBytesPerSec)}/s</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {upload.queue.map((queue) => (
                <div
                  key={queue.pid}
                  className="flex w-full flex-col gap-2 border-b pb-4 last:border-b-0"
                >
                  <div className="flex w-full flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="flex aspect-square w-10 items-center justify-center rounded-md bg-secondary">
                        {queue.directories && queue.directories.length > 0 ? (
                          <FolderIcon />
                        ) : (
                          <FileIcon />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="line-clamp-1 break-all text-ellipsis">{queue.name}</p>
                        <p className="line-clamp-1 text-xs break-all text-ellipsis text-muted-foreground">
                          {formatSize(queue.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-1">
                      <button
                        type="button"
                        aria-label={t("upload.transfer.action.cancel")}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => {
                          akasha.ULProcess.CancelUpload(queue.pid);
                        }}
                        tabIndex={-1}
                      >
                        <CircleXIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {download.queue.map((queue) => (
                <div
                  key={queue.pid}
                  className="flex w-full flex-col gap-2 border-b pb-4 last:border-b-0"
                >
                  <div className="flex w-full flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-4">
                      <div className="flex aspect-square w-10 items-center justify-center rounded-md bg-secondary">
                        <DownloadIcon />
                      </div>
                      <div className="flex flex-col">
                        <p className="line-clamp-1 break-all text-ellipsis">{queue.name}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {total === 0 && (
                <div className="flex w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ArrowUpDownIcon />
                  <p className="text-base">{t("drive.ui.process_sheet.no_transfer_yet")}</p>
                </div>
              )}
            </div>
          </div>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
