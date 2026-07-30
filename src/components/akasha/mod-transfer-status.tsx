import { Archive as FileArchiveIcon, File as FileIcon } from "pixelarticons/react";
import { forwardRef, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUploadSessionActionAvailability } from "@/lib/akasha/upload-v2/policy";
import { cn, formatSize } from "@/lib/utils";
import { useUploadSessionStore } from "@/stores/akasha-upload-session.store";

import { AnimatedBeam } from "../magicui/animated-beam";

// export function TransferStatus() {
//   const { totalItems, sentItems } = useModStore();

//   return (
//     <Center
//       className='flex bg-black z-50 p-3'
//       size="page-full"
//     >
//       <div className="size-full max-w-[500px] max-h-[500px]">

//       </div>
//     </Center>
//   )
// }

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "z-10 flex size-12 items-center justify-center rounded-full border-2 bg-muted p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

Circle.displayName = "Circle";

export function Archiving() {
  const containerRef = useRef<HTMLDivElement>(null);
  const div1Ref = useRef<HTMLDivElement>(null);
  const div2Ref = useRef<HTMLDivElement>(null);
  const div3Ref = useRef<HTMLDivElement>(null);
  const div4Ref = useRef<HTMLDivElement>(null);
  const div5Ref = useRef<HTMLDivElement>(null);
  const div6Ref = useRef<HTMLDivElement>(null);
  const div7Ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden p-10"
      ref={containerRef}
    >
      <div className="flex size-full max-w-lg flex-col items-stretch justify-between">
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div1Ref}>
            <FileIcon />
          </Circle>
          <Circle ref={div5Ref}>
            <FileIcon />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div2Ref}>
            <FileIcon />
          </Circle>
          <Circle ref={div4Ref} className="size-16">
            {/* <FileIcon /> */}
            <FileArchiveIcon />
          </Circle>
          <Circle ref={div6Ref}>
            <FileIcon />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div3Ref}>
            <FileIcon />
          </Circle>
          <Circle ref={div7Ref}>
            <FileIcon />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
      />
      <AnimatedBeam containerRef={containerRef} fromRef={div2Ref} toRef={div4Ref} />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div5Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
        reverse
      />
      <AnimatedBeam containerRef={containerRef} fromRef={div6Ref} toRef={div4Ref} reverse />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div7Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
        reverse
      />
    </div>
  );
}

export function TransferDialog() {
  const uploadSessions = useUploadSessionStore();
  const { t } = useTranslation();
  const snapshots = Object.values(uploadSessions.snapshots).filter(
    (snapshot) => snapshot.session.kind === "mod",
  );

  return (
    <Dialog open={snapshots.length > 0}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("upload.transfer.title")}</DialogTitle>
          <DialogDescription>{t("upload.transfer.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {snapshots.map((snapshot) => {
            const completed = snapshot.targets.filter((target) =>
              ["created", "exists", "completed"].includes(target.status),
            ).length;
            const actions = getUploadSessionActionAvailability(snapshot);
            const runAction = (action: () => Promise<void>) =>
              action().catch((error) => {
                toast.error(t("upload.transfer.action_error"), {
                  description: error instanceof Error ? error.message : String(error),
                });
              });
            return (
              <section key={snapshot.session.requestId} className="border bg-card p-3">
                <div className="flex items-start justify-between gap-3 border-b pb-2">
                  <div className="min-w-0">
                    <strong className="block truncate">{snapshot.session.name}</strong>
                    <small className="text-muted-foreground">
                      {completed}/{snapshot.targets.length} ·{" "}
                      {formatSize(snapshot.session.totalBytes)}
                    </small>
                  </div>
                  <div className="flex gap-2">
                    {actions.canRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClickPromise={() =>
                          runAction(() => uploadSessions.retry(snapshot.session.requestId))
                        }
                      >
                        {t("upload.transfer.action.retry")}
                      </Button>
                    )}
                    {actions.canCancel && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClickPromise={() =>
                          runAction(() => uploadSessions.dismiss(snapshot.session.requestId))
                        }
                      >
                        {t("upload.transfer.action.cancel")}
                      </Button>
                    )}
                    {actions.canDismiss && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClickPromise={() =>
                          runAction(() => uploadSessions.dismiss(snapshot.session.requestId))
                        }
                      >
                        {t("upload.transfer.action.dismiss")}
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  {snapshot.targets.map((target) => (
                    <div
                      key={target.clientId}
                      className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate">{target.name}</span>
                      <small className="max-w-48 text-right">
                        {t(`upload.transfer.status.${target.status}`, {
                          defaultValue: target.status,
                        })}
                        {target.reason && (
                          <span className="block break-words text-destructive">
                            {t(`upload.transfer.reason.${target.reason}`, {
                              defaultValue: target.reason,
                            })}
                          </span>
                        )}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
