import { Link, useLocation } from "@tanstack/react-router";
import {
  Server as HardDriveIcon,
  Settings2 as SettingsIcon,
  Share as Share2Icon,
  Trash as Trash2Icon,
} from "pixelarticons/react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDialogStore } from "@/lib/akasha";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { ProcessSheet } from "./ProcessSheet";

export const sheetTriggerClass =
  "active flex w-full flex-row items-center gap-2.5 rounded-md p-2 text-primary transition-all hover:bg-secondary";

export function SidePanel() {
  const { t } = useTranslation();
  const dialog = useDialogStore();
  const location = useLocation();
  const { data: session } = useSession();
  const driveRootId = session?.drive?.rootId;

  return (
    <div className="dragselect-start-allowed flex flex-col overflow-x-hidden overflow-y-auto">
      <div className="mb-3 flex h-14 flex-row items-center justify-between border-b p-2">
        <Tooltip delayDuration={50}>
          <TooltipTrigger>
            <ProcessSheet />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t("drive.ui.transfers")}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mb-0.5 flex flex-col px-2">
        <div className="flex flex-col gap-1">
          {driveRootId && (
            <Tooltip delayDuration={50}>
              <TooltipTrigger>
                <Link
                  to="/akasha/drive/$itemId"
                  params={{ itemId: driveRootId }}
                  className={cn(
                    sheetTriggerClass,
                    location.pathname.endsWith("/root") && "bg-secondary",
                  )}
                >
                  <HardDriveIcon />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{t("drive.ui.my_drive")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip delayDuration={50}>
            <TooltipTrigger>
              <Link
                to="/akasha/drive/$itemId"
                params={{ itemId: "share" }}
                className={cn(
                  sheetTriggerClass,
                  location.pathname.endsWith("/share") && "bg-secondary",
                )}
              >
                <Share2Icon />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t("drive.ui.share")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex w-full flex-col overflow-hidden"></div>
      </div>

      <div className="mt-2 mb-3 h-[1px] w-full shrink-0 bg-border"></div>

      <div className="space-y-1">
        <div className="flex flex-col px-2">
          <Tooltip delayDuration={50}>
            <TooltipTrigger>
              <ContextMenu>
                <ContextMenuTrigger>
                  <Link
                    to="/akasha/drive/trash"
                    className={cn(
                      sheetTriggerClass,
                      location.pathname.endsWith("trash") && "bg-secondary",
                    )}
                  >
                    <Trash2Icon />
                  </Link>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    className="cursor-pointer gap-x-2"
                    onClick={() => dialog.setOpen("emptyTrashDialog", true)}
                  >
                    <Trash2Icon width={20} height={20} />
                    {t("drive.ui.empty_trash")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t("drive.ui.trash")}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col px-2">
          <Tooltip delayDuration={50}>
            <TooltipTrigger>
              <Link
                to="/akasha/drive/settings"
                className={cn(
                  sheetTriggerClass,
                  location.pathname.endsWith("settings") && "bg-secondary",
                )}
              >
                <SettingsIcon />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t("drive.ui.settings")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
