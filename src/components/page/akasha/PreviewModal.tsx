import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { LoaderIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDialogStore, type ContentPreview, type LayoutType } from "@/lib/akasha";
import { previewCache } from "@/lib/image-cache";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  preview?: ContentPreview;
  alt: string;
  type: LayoutType;
}

export function PreviewModal(props: Props) {
  if (!props.preview) return null;

  const [open, setOpen] = useState(false);

  const dialog = useDialogStore();

  function imgErrorHandle(e: React.SyntheticEvent) {
    if (e.currentTarget) {
      // @ts-ignore
      e.currentTarget.src = "/puhaha.jpg";
    }
  }

  const hasVideo = !!props.preview.video?.default;

  const onMouseEvent = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        dialog.setOpen("previewDialog", v);
      }}
    >
      <DialogTrigger className={props.className} onClick={(e) => e.stopPropagation()}>
        {hasVideo ? (
          <video
            src={props.preview.video?.default}
            className="aspect-square rounded-md object-cover"
            draggable="false"
            muted
            autoPlay
            loop
            controls={false}
          />
        ) : (
          <img
            src={
              props.type === "list"
                ? props.preview!.img!.thumbnail || props.preview!.img!.default
                : props.preview!.img!.cover || props.preview!.img!.default
            }
            alt={props.alt}
            className="aspect-square rounded-md object-cover"
            draggable="false"
            loading="lazy"
            onError={imgErrorHandle}
          />
        )}
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="size-fit overflow-hidden p-0 sm:max-w-none"
        onClick={onMouseEvent}
        onContextMenu={onMouseEvent}
        overlayOnContextMenu={onMouseEvent}
      >
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
        </VisuallyHidden>

        {hasVideo ? (
          <video
            src={props.preview.video?.default}
            draggable="false"
            muted
            autoPlay
            loop
            controls={false}
            className="max-h-[85vh] max-w-[85vw] cursor-pointer"
            onClick={() => setOpen(false)}
          />
        ) : (
          <img
            src={props.preview.img?.default}
            draggable="false"
            className="max-h-[85vh] max-w-[85vw] cursor-pointer"
            onClick={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
