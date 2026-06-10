import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDialogStore } from "@/lib/akasha";
import { eden } from "@/lib/eden";

interface SearchDialogProps {
  of: "drive" | "link" | "mod";
  dest?: string;
  link?: {
    linkId: string;
    password: string;
  };
}

export function SearchDialog(props: SearchDialogProps) {
  const { of, dest, link } = props;

  const { searchDialog, setOpen } = useDialogStore();

  const [files, setFiles] = useState<File[]>([]);

  const query = useQuery({
    queryKey: ["akasha", "search", "dialog", files[0]?.name],
    queryFn: async () => {
      console.log(files.length);
      if (files.length !== 1) return;
      const file = files[0] as File;

      const { data, error } = await eden.akasha.common.search.post({
        mode: of === "drive" ? "drive" : "link",
        dest: dest || "root",
        imgQ: file,
        ...(link?.linkId && { linkId: link.linkId }),
        ...(link?.password && { linkPwd: link.password }),
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
    enabled: !!files[0]?.name,
  });

  return (
    <Dialog
      open={searchDialog.open}
      onOpenChange={(v) => {
        setOpen("searchDialog", v);
        setFiles([]);
      }}
    >
      <DialogTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <SearchIcon />
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="w-sm">
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>

        <div className="w-full min-w-0">
          <Dropzone
            accept={{ "image/*": [] }}
            maxFiles={1}
            maxSize={1024 * 1024 * 10}
            minSize={1024}
            onDrop={setFiles}
            onError={(err) => {
              toast.warning(err.message);
            }}
            src={files}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          <div></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
