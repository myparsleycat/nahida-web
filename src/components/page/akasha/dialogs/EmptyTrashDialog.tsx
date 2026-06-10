import { useRouteContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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

  return (
    <AlertDialog open={emptyTrashDialog.open} onOpenChange={(v) => setOpen("emptyTrashDialog", v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("drive.ui.empty_trash")}</AlertDialogTitle>
          <AlertDialogDescription>{t("drive.ui.empty_trash_dialog.0")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void akasha.empty().then(() => {
                void queryClient.refetchQueries({
                  queryKey: ["akasha:drive:trash"],
                });
                setOpen("emptyTrashDialog", false);
              });
            }}
          >
            {t("drive.ui.empty_trash_dialog.1")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
