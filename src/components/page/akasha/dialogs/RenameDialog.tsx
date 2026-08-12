import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContentSelection } from "@/hooks/akasha";
import { akasha, useDialogStore, type Content } from "@/lib/akasha";
import { ValidateName } from "@/lib/akasha/utils";
import { eden } from "@/lib/eden";
import { cn } from "@/lib/utils";

export function RenameDialog() {
  const { t } = useTranslation();
  const dialog = useDialogStore();
  const selection = useContentSelection();
  const itemId = useParams({ from: "/akasha/drive/$itemId" }).itemId;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ["akasha", "rename", itemId],
    mutationFn: async ({ item, rename }: { item: Content; rename: string }) => {
      const { data, error } = await eden.akasha.content.rename({ id: item.id }).post({
        rename,
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
  });

  if (!selection.selectedItems[0]) {
    return null;
  }

  return (
    <Dialog open={dialog.renameDialog.open} onOpenChange={(v) => dialog.setOpen("renameDialog", v)}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("drive.ui.rename")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col space-y-4"
          autoComplete="off"
          onSubmit={async (e) => {
            e.preventDefault();

            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);

            const name = formData.get("name") as string;
            if (!name || typeof name !== "string" || name.trim() === "") {
              toast.warning(t("#.RenameItem.0"));
              return;
            }

            const ext = (formData.get("ext") as string) || "";

            const rename = name + ext;

            const validate_result = ValidateName(rename);
            if (validate_result) {
              return toast.warning(t("#.RenameItem.1"), {
                description: validate_result,
              });
            }

            const renamePromise = mutation.mutateAsync({
              item: selection.selectedItems[0],
              rename,
            });

            toast.promise(renamePromise, {
              loading: t("#.RenameItem.toast-promise.loading"),
              success: async () => {
                await akasha.refetch({ itemId });
                await queryClient.refetchQueries({
                  queryKey: ["akasha", "drive", "search"],
                });
                dialog.setOpen("renameDialog", false);
                return t("#.RenameItem.toast-promise.success");
              },
              error: (e: any) => e.message,
            });
          }}
        >
          <div className="flex flex-row gap-x-4">
            <input
              className={cn(
                "block w-full rounded-lg border-none bg-black/5 px-3 py-2 text-sm/6 text-black dark:bg-white/5 dark:text-white",
                "focus:outline-2 focus:-outline-offset-2 focus:outline-black/25 focus:dark:outline-white/25",
              )}
              name="name"
              placeholder={t("drive.ui.name")}
              maxLength={200}
              required
              defaultValue={
                selection.selectedItems.length === 1 &&
                !selection.selectedItems[0].isDir &&
                selection.selectedItems[0].name.includes(".")
                  ? selection.selectedItems[0].name.split(".").slice(0, -1).join(".")
                  : selection.selectedItems.length === 1
                    ? selection.selectedItems[0].name
                    : ""
              }
            />
            {!selection.selectedItems[0].isDir && (
              <input
                className={cn(
                  "block w-1/4 rounded-lg border-none bg-black/5 px-3 py-2 text-sm/6 text-black dark:bg-white/5 dark:text-white",
                  "focus:outline-2 focus:-outline-offset-2 focus:outline-black/25 focus:dark:outline-white/25",
                )}
                name="ext"
                placeholder={t("drive.ui.ext")}
                maxLength={50}
                defaultValue={
                  selection.selectedItems.length === 1 &&
                  selection.selectedItems[0].name.includes(".")
                    ? "." + selection.selectedItems[0].name.split(".").pop()
                    : ""
                }
              />
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={async (e) => {
                e.preventDefault();
                dialog.setOpen("renameDialog", false, undefined);
              }}
            >
              {t("g.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("drive.ui.rename")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
