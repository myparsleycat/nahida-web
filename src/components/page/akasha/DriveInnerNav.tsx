import { Link, useLocation } from "@tanstack/react-router";
import { HardDriveIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProcessSheet } from "@/components/page/akasha/ProcessSheet";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRequireSession } from "@/hooks/auth.hook";
import { useDialogStore } from "@/lib/akasha";
import { cn } from "@/lib/utils";

interface DriveInnerNavProps {
  labeled?: boolean;
}

export function DriveInnerNav(props: DriveInnerNavProps) {
  const { labeled = false } = props;
  const { data: session } = useRequireSession();
  const driveRootId = session?.drive?.rootId;
  const { t } = useTranslation();
  const location = useLocation();
  const dialog = useDialogStore();

  const itemClass = cn(
    "active flex w-full cursor-pointer flex-row items-center rounded-md p-2 text-primary transition-all hover:bg-secondary",
    labeled && "gap-3 px-3",
    !labeled && "gap-2.5",
  );

  return (
    <div className="flex h-full w-full flex-col select-none">
      <div className="dragselect-start-allowed flex flex-col overflow-x-hidden overflow-y-auto">
        <div className="mb-3 flex h-14 flex-row items-center justify-between border-b p-2">
          <Tooltip delayDuration={50}>
            <TooltipTrigger asChild>
              <ProcessSheet />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t("drive.ui.transfers")}</p>
            </TooltipContent>
          </Tooltip>
          {labeled && <span className="pr-2 text-sm font-medium">{t("drive.ui.transfers")}</span>}
        </div>

        <div className="mb-0.5 flex flex-col px-2">
          <div className="flex flex-col gap-1">
            {driveRootId && (
              <NavRow
                labeled={labeled}
                active={location.pathname.endsWith("/root")}
                params={{ itemId: driveRootId }}
                icon={<HardDriveIcon />}
                label={t("drive.ui.my_drive")}
              />
            )}

            <NavRow
              labeled={labeled}
              active={location.pathname.endsWith("/share")}
              params={{ itemId: "share" }}
              icon={<Share2Icon />}
              label={t("drive.ui.share")}
            />
          </div>
          <div className="flex w-full flex-col overflow-hidden"></div>
        </div>

        <div className="mt-2 mb-3 h-px w-full shrink-0 bg-border"></div>

        <div className="space-y-1">
          <div className="flex flex-col px-2">
            <Tooltip delayDuration={50}>
              <TooltipTrigger>
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Link
                      to="/akasha/drive/trash"
                      className={cn(
                        itemClass,
                        "bg-transparent",
                        location.pathname.endsWith("trash") && "bg-secondary",
                      )}
                    >
                      <Trash2Icon />
                      {labeled && <span className="text-sm">{t("drive.ui.trash")}</span>}
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      className="cursor-pointer gap-x-2"
                      onClick={() => dialog.setOpen("emptyTrashDialog", true)}
                    >
                      <Trash2Icon size={20} />
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
        </div>
      </div>
    </div>
  );
}

interface NavRowProps {
  labeled: boolean;
  active: boolean;
  params: { itemId: string };
  icon: React.ReactNode;
  label: string;
}

function NavRow(props: NavRowProps) {
  const { labeled, active, params, icon, label } = props;

  if (labeled) {
    return (
      <Link
        to="/akasha/drive/$itemId"
        params={params}
        className={cn(
          "active flex w-full cursor-pointer flex-row items-center gap-3 rounded-md p-2 px-3 text-primary transition-all hover:bg-secondary",
          active && "bg-secondary",
        )}
      >
        {icon}
        <span className="text-sm">{label}</span>
      </Link>
    );
  }

  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger>
        <Link
          to="/akasha/drive/$itemId"
          params={params}
          className={cn(
            "active flex w-full cursor-pointer flex-row items-center gap-2.5 rounded-md p-2 text-primary transition-all hover:bg-secondary",
            active && "bg-secondary",
          )}
        >
          <div className="flex flex-row items-center gap-2">
            <div>{icon}</div>
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
