import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Archive as FileArchiveIcon, File as FileIcon } from "pixelarticons/react";
import { forwardRef, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUploadSessionActionAvailability } from "@/lib/akasha/upload-v2/policy";
import { cn, formatSize } from "@/lib/utils";
import { useModStore } from "@/stores/akasha-mod.store";
import { useUploadSessionStore } from "@/stores/akasha-upload-session.store";

import { AliceLoader } from "../common";
import { AnimatedBeam } from "../magicui/animated-beam";
import { Progress } from "../ui/progress";

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
  const transfer = useModStore();
  const uploadSessions = useUploadSessionStore();
  const { t } = useTranslation();
  const snapshots = Object.values(uploadSessions.snapshots).filter(
    (snapshot) => snapshot.session.kind === "mod",
  );
  const upload =
    snapshots.find(
      (snapshot) =>
        !["completed", "partial", "failed", "paused", "cancelled"].includes(
          snapshot.session.status,
        ),
    ) ??
    snapshots.find((snapshot) => ["partial", "failed", "paused"].includes(snapshot.session.status));
  const actions = upload && getUploadSessionActionAvailability(upload);
  const hasError = upload && ["partial", "failed", "paused"].includes(upload.session.status);
  const completedTargets = upload?.targets.filter((target) =>
    ["created", "exists", "completed"].includes(target.status),
  );
  const status = upload
    ? hasError
      ? "failed"
      : upload.session.status === "staging"
        ? "collecting"
        : ["creating_directories", "hashing", "planning"].includes(upload.session.status)
          ? "hashing"
          : "transmitting"
    : transfer.status;
  const totalItems = upload?.targets.length ?? transfer.totalItems;
  const sentItems = completedTargets?.length ?? transfer.sentItems;
  const totalBytes = upload?.session.totalBytes ?? transfer.totalBytes;
  const sentBytes =
    completedTargets?.reduce((sum, target) => sum + target.size, 0) ?? transfer.sentBytes;
  const progress = upload
    ? totalBytes
      ? Math.min((sentBytes / totalBytes) * 100, 100)
      : upload.session.status === "completed"
        ? 100
        : 0
    : transfer.progress;
  const displayItems = Math.min(totalItems, 256);
  const displaySentItems =
    totalItems > 256 ? Math.floor((sentItems / totalItems) * 256) : sentItems;
  const gridCols = Math.ceil(Math.sqrt(displayItems));

  return (
    <Dialog open={status !== "pending"}>
      <VisuallyHidden>
        <DialogHeader>
          <DialogTitle>Transferring Items</DialogTitle>
        </DialogHeader>
      </VisuallyHidden>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex min-h-[18.5rem] flex-col items-center justify-center gap-y-4">
          {status === "hashing" || status === "collecting" ? (
            <>
              <p className="font-semibold">
                {status === "hashing" ? "Hashing..." : "Collecting Files..."}
              </p>
              <AliceLoader />
            </>
          ) : status === "transmitting" ? (
            <>
              <p className="font-semibold">Transmitting...</p>
              {displayItems > 0 && (
                <div
                  className="grid h-64 w-64 gap-1 border p-1"
                  style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
                >
                  {Array.from({ length: displayItems }).map((_, index) => (
                    <div
                      key={index}
                      className={index < displaySentItems ? "bg-foreground" : "bg-muted"}
                    />
                  ))}
                </div>
              )}
              <small>
                {formatSize(sentBytes)} / {formatSize(totalBytes)} | {formatSize(transfer.speed)}/s
              </small>
              <Progress value={progress} />
            </>
          ) : status === "failed" && upload && actions ? (
            <>
              <p className="font-semibold">{t("upload.transfer.status.failed")}</p>
              <small className="text-muted-foreground">
                {upload.session.name} · {sentItems}/{totalItems}
              </small>
              <div className="flex gap-2">
                {actions.canRetry && (
                  <Button
                    variant="outline"
                    onClickPromise={() =>
                      uploadSessions.retry(upload.session.requestId).catch((error) => {
                        toast.error(t("upload.transfer.action_error"), {
                          description: error instanceof Error ? error.message : String(error),
                        });
                      })
                    }
                  >
                    {t("upload.transfer.action.retry")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClickPromise={() => uploadSessions.dismiss(upload.session.requestId)}
                >
                  {t("upload.transfer.action.dismiss")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
