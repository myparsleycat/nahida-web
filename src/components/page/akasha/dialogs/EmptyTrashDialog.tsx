import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { akasha, useDialogStore } from "@/lib/akasha";

export function EmptyTrashDialog() {
  const { t } = useTranslation();
  const { emptyTrashDialog, setOpen } = useDialogStore();
  const { queryClient } = useRouteContext({ from: "__root__" });
  const [isPending, setIsPending] = useState(false);

  return (
    <AlertDialog
      open={emptyTrashDialog.open}
      onOpenChange={(v) => {
        if (isPending) return;
        setOpen("emptyTrashDialog", v);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("drive.ui.empty_trash")}</AlertDialogTitle>
          <AlertDialogDescription>{t("drive.ui.empty_trash_dialog.0")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("g.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              if (isPending) return;
              setIsPending(true);
              void akasha
                .empty()
                .then(async (result) => {
                  await queryClient.refetchQueries({
                    queryKey: ["akasha:drive:trash"],
                  });
                  toast.success(
                    result.kind === "completed"
                      ? t("#.EmptyTrash.toast-promise.completed")
                      : t("#.EmptyTrash.toast-promise.success"),
                  );
                  setOpen("emptyTrashDialog", false);
                })
                .catch((err: unknown) => {
                  toast.error(t("#.EmptyTrash.toast-promise.error"), {
                    description: err instanceof Error ? err.message : String(err),
                  });
                })
                .finally(() => {
                  setIsPending(false);
                });
            }}
          >
            {isPending
              ? t("#.EmptyTrash.toast-promise.loading")
              : t("drive.ui.empty_trash_dialog.1")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
