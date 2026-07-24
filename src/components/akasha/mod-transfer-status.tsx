import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Archive as ArchiveIcon,
  Archive as FileArchiveIcon,
  File as FileIcon,
  Loader as Loader2,
} from "pixelarticons/react";
import { forwardRef, useRef } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatSize } from "@/lib/utils";
import { useModStore } from "@/stores/akasha-mod.store";

import { AliceLoader, Center } from "../common";
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
  const { status, totalItems, sentItems, totalBytes, sentBytes, speed, progress } = useModStore();

  const MAX_VISUAL_ITEMS = 256;

  const displayItems = Math.min(totalItems, MAX_VISUAL_ITEMS);

  const displaySentItems =
    totalItems > MAX_VISUAL_ITEMS
      ? Math.floor((sentItems / totalItems) * MAX_VISUAL_ITEMS)
      : sentItems;

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
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <div className="flex min-h-[18.5rem] flex-col items-center justify-center gap-y-4">
          {status === "hashing" ? (
            <>
              <p className="text-lg font-semibold">Hashing...</p>
              <AliceLoader />
            </>
          ) : status === "collecting" ? (
            <>
              <p className="text-lg font-semibold">Collecting Files...</p>
              <AliceLoader />
            </>
          ) : status === "transmitting" ? (
            <>
              <p className="text-lg font-semibold">Transmitting...</p>
              <div
                className="grid h-64 w-64 gap-1 rounded-lg border p-1"
                style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
              >
                {Array.from({ length: displayItems }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-xs ${
                      i < displaySentItems ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm">
                {formatSize(sentBytes)} / {formatSize(totalBytes)} (압축됨) | {formatSize(speed)}/s
              </p>
              <Progress value={progress} />
            </>
          ) : (
            <></>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
