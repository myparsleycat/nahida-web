import { Copy as CopyIcon, Loader as LoaderIcon } from "pixelarticons/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDialogStore } from "@/lib/akasha";
import { cn } from "@/lib/utils";

import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { LinkToggle } from "./LinkToggle";
import { PasswordForm } from "./PasswordForm";
import { PermissionList } from "./PermissionList";
import { usePubLinkMutations, usePubLinkQuery } from "./usePubLinkMutations";

export function PubLinkDialog() {
  const dialog = useDialogStore();

  const itemId = useMemo(() => {
    return dialog.shareDialog.data?.id as string | undefined;
  }, [dialog.shareDialog.data]);

  const [password, setPassword] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [pubLinkSwitchChecked, setPubLinkSwitch] = useState(false);

  const query = usePubLinkQuery(itemId);

  const {
    handleChangePermission,
    handleDeletePermission,
    handleCopyInviteUrl,
    handlePasswordSubmit,
    handleDatePickerSave,
    handlePubLinkToggle,
    handleCopyLink,
  } = usePubLinkMutations(query, itemId);

  // Sync state with query data
  useMemo(() => {
    if (query.data) {
      if (query.data.link?.expires_at) {
        setSelectedDate(new Date(query.data.link.expires_at));
      }
      setPubLinkSwitch(!!query.data.link);
    }
  }, [query.data]);

  return (
    <Dialog
      open={dialog.shareDialog.open}
      onOpenChange={(v) => {
        if (!v) setSelectedDate(undefined);
        dialog.setOpen("shareDialog", v);
      }}
    >
      <DialogTitle></DialogTitle>
      <DialogContent aria-describedby={undefined} className="min-w-md">
        {query.data ? (
          <div className="flex flex-col gap-y-8">
            <PermissionList
              permissions={query.data.permissions}
              onChangePermission={handleChangePermission}
              onDeletePermission={handleDeletePermission}
              onCopyInviteUrl={handleCopyInviteUrl}
            />

            <div className="w-full">
              <LinkToggle
                hasLink={!!query.data.link}
                checked={pubLinkSwitchChecked}
                onCheckedChange={setPubLinkSwitch}
                onToggle={() => handlePubLinkToggle(setPubLinkSwitch, pubLinkSwitchChecked)}
              />

              {query.data.link && (
                <div className="flex flex-col gap-4">
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <PasswordForm
                      hasPassword={!!query.data.link.password}
                      password={password}
                      onPasswordChange={setPassword}
                      onSubmit={(e) => handlePasswordSubmit(e, !!query.data.link?.password)}
                    />

                    <ExpiryDatePicker
                      selectedDate={selectedDate}
                      onDateChange={setSelectedDate}
                      onSave={() => handleDatePickerSave(selectedDate)}
                    />
                  </div>

                  <div className="flex flex-row gap-x-3">
                    <input
                      className={cn(
                        "w-full rounded-lg border-none bg-black/5 px-3 py-1.5 text-sm/6 dark:bg-white/5",
                        "focus:outline-hidden data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25",
                      )}
                      type="link"
                      id="link"
                      value={query.data.link.url}
                      readOnly
                    />
                    <Button
                      type="button"
                      className="aspect-square"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                    >
                      <CopyIcon className="pointer-events-none" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <LoaderIcon className="animate-spin-1.5" width={40} height={40} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
