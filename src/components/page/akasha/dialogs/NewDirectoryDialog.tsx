import { useMutation } from "@tanstack/react-query";
import { useParams, useRouteContext } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDialogStore, type Content } from "@/lib/akasha";
import { ValidateName } from "@/lib/akasha/utils";
import { eden } from "@/lib/eden";

export function NewDirectoryDialog({ contents }: { contents: Content[] }) {
  const { t } = useTranslation();
  const dialog = useDialogStore();
  const current = useParams({ from: "/akasha/drive/$itemId" }).itemId;
  const { queryClient } = useRouteContext({ from: "__root__" });

  const mutation = useMutation({
    mutationKey: ["akasha", "make_dir", current],
    mutationFn: async ({ name }: { name: string }) => {
      const { error } = await eden.akasha.dir.create_many.post({
        parentId: current,
        dirs: [{ path: name, name }],
      });

      if (error) {
        throw new Error(error.value.toString());
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = formData.get("name") as string;

    const validate_result = ValidateName(name);
    if (validate_result) {
      return toast.warning(t("#.CreateDir.0"), {
        description: validate_result,
      });
    }

    if (contents.some((item) => item.isDir && item.name === name)) {
      return toast.warning(t("#.CreateDir.2"));
    }

    await mutation
      .mutateAsync({ name })
      .then(async () => {
        toast.success(t("#.CreateDir.toast-promise.success"));
        dialog.setOpen("createDirDialog", false);
        await queryClient.refetchQueries({
          queryKey: ["akasha", "drive", "item", current],
        });
      })
      .catch((err) => {
        toast.error(err.message);
      });
  };

  return (
    <Dialog
      open={dialog.createDirDialog.open}
      onOpenChange={(v) => dialog.setOpen("createDirDialog", v)}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("drive.ui.new_dir")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col space-y-4" autoComplete="off" onSubmit={handleSubmit}>
          <Input name="name" placeholder={t("drive.ui.name")} maxLength={255} required />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                dialog.setOpen("createDirDialog", false);
              }}
            >
              {t("g.cancel")}
            </Button>
            <Button type="submit" className="flex items-center gap-2">
              {mutation.isPending && <Loader2Icon />}
              {t("drive.ui.new_dir")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
