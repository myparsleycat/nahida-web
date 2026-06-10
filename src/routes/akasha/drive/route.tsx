import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { HardDriveIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyTrashDialog } from "@/components/page/akasha/dialogs";
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

export const Route = createFileRoute("/akasha/drive")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "드라이브 | 나히다 라이브" }],
  }),
});

function RouteComponent() {
  const { data: session } = useRequireSession();
  const driveRootId = session?.drive?.rootId;
  const { t } = useTranslation();
  const location = useLocation();
  const dialog = useDialogStore();

  return (
    <>
      <div className="h-full">
        <div className="flex h-full w-full data-[panel-group-direction=vertical]:flex-col">
          <div className="flex flex-col border-r">
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
                              "active flex w-full cursor-pointer flex-row items-center gap-2.5 rounded-md p-2 text-primary transition-all hover:bg-secondary",
                              location.pathname.endsWith("/root") && "bg-secondary",
                            )}
                          >
                            <div className="flex flex-row items-center gap-2">
                              <div>
                                <HardDriveIcon />
                              </div>
                            </div>
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
                            "active flex w-full flex-row items-center gap-2.5 rounded-md p-2 text-primary transition-all hover:bg-secondary",
                            location.pathname.endsWith("/share") && "bg-secondary",
                          )}
                        >
                          <div className="flex flex-row items-center gap-2">
                            <div>
                              <Share2Icon />
                            </div>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{t("drive.ui.share")}</p>
                      </TooltipContent>
                    </Tooltip>
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
                                "flex w-full flex-row items-center gap-2.5 rounded-md bg-transparent p-2 text-primary transition-all hover:bg-secondary",
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

                  {/* <div className="flex flex-col px-2">
                    <Tooltip delayDuration={50}>
                      <TooltipTrigger>
                        <Link
                          to='/akasha/drive/settings'
                          className={cn(
                            "flex flex-row gap-2.5 w-full p-2 rounded-md transition-all items-center hover:bg-secondary text-primary bg-transparent",
                            location.pathname.endsWith("settings") && "bg-secondary"
                          )}
                        >
                          <SettingsIcon />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{t("drive.ui.settings")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div> */}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="relative flex h-full grow">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      <EmptyTrashDialog />
    </>
  );
}
