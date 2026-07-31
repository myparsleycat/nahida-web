import { useMutation } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import {
  Bell as BellIcon,
  Copy as CopyIcon,
  Delete as DeleteIcon,
  Eye as EyeIcon,
  Folder as FolderIcon,
  Globe as GlobeIcon,
  Monitor as MonitorIcon,
  Pointer as MousePointer2Icon,
  Undo as RotateCcwIcon,
  Share as Share2Icon,
  Pencil as SquarePenIcon,
  Trash as Trash2Icon,
  Close as XIcon,
} from "pixelarticons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AkashaModData } from "@/lib/akasha/services/drive-types";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ContextMenuContext } from "@/context/ContextMenuContext";
import { useModContext } from "@/context/ModContext";
import { useContentSelection, useContentMenu } from "@/hooks/akasha";
import { akasha, useDialogStore, type Content } from "@/lib/akasha";
import { startAkashaDownloadForDesktop } from "@/lib/akasha/services/drive-download";
import { DeleteItem } from "@/lib/akasha/services/mod-drive/common";
import { startDownload, startDownloadForDesktop } from "@/lib/akasha/services/mod-drive/download";
import { type Session, useSession } from "@/lib/auth-client";

import { ImportToMyDriveDialog } from "./HeadButtons";

interface ContextMenuProviderProps {
  itemId: string;
  children: React.ReactNode;
  of: "drive" | "link" | "mod";
  link?: { linkId: string; token: string };
  navi?: (id: string) => void;
}

export function ContextMenuProvider(props: ContextMenuProviderProps) {
  const { itemId, children, of, link, navi } = props;
  const { selection } = useContentMenu();
  const { data: session } = useSession();

  const contextValue = { itemId, navi };

  const handleEmptyAreaClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".sorted-contents")) {
      selection.setSelectedItems([]);
      selection.setLastSelectedIdx(null);
    }
  };

  return (
    <ContextMenuContext.Provider value={contextValue}>
      <ContextMenu>
        <ContextMenuTrigger
          className="flex-1 overflow-x-hidden overflow-y-auto"
          onClick={handleEmptyAreaClick}
          onContextMenu={handleEmptyAreaClick}
        >
          {children}
        </ContextMenuTrigger>

        <ContextMenuContent className="flex-1">
          {of === "drive" ? (
            <ContextMenuContentSnippet itemId={itemId} />
          ) : of === "link" && link && navi ? (
            <ContextMenuLinkContentSnippet
              link={link}
              itemId={itemId}
              navi={navi}
              session={session}
            />
          ) : of === "mod" && navi ? (
            <ContextMenuModContentSnippet itemId={itemId} navi={navi} session={session} />
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </ContextMenuContext.Provider>
  );
}

interface ContextMenuContentSnippetProps {
  itemId: string;
}

function ContextMenuContentSnippet(props: ContextMenuContentSnippetProps) {
  const { itemId } = props;
  const { selectedItems, setSelectedItems, setCopyOrCuts } = useContentSelection();
  const dialog = useDialogStore();
  const { t } = useTranslation();
  const { queryClient } = useRouteContext({ from: "__root__" });

  const trashMutation = useMutation({
    mutationKey: ["akasha", "drive", "trash"],
    mutationFn: async ({ items }: { items: Content[] }) => {
      const ids = items.map((item) => item.id);
      return akasha.trashMany(ids);
    },
    onSuccess: async (resp) => {
      await queryClient.refetchQueries({
        queryKey: ["akasha", "drive", "item", itemId],
      });
      toast.success(`${resp.length}개의 파일 및 디렉토리가 휴지통으로 이동되었습니다`);
      setSelectedItems([]);
    },
    onError: (err) => {
      if (err.message.toLocaleLowerCase().includes("forbidden")) {
        toast.warning("권한이 없습니다");
        return;
      }

      toast.error(err.message);
    },
  });

  return selectedItems && selectedItems.length !== 0 ? (
    <>
      {selectedItems.length === 1 && (
        <>
          {selectedItems[0].isDir && (
            <>
              <ContextMenuItem asChild>
                <Link
                  to="/akasha/drive/$itemId"
                  params={{ itemId: selectedItems[0].id }}
                  className="gap-x-2"
                >
                  <MousePointer2Icon width={18} height={18} />
                  {t("drive.ui.context_menu.open")}
                </Link>
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          {selectedItems[0].mimeType?.startsWith("text") ||
            (selectedItems[0].mimeType?.startsWith("image") && (
              <ContextMenuItem className="cugap-x-2">
                <EyeIcon width={18} height={18} />
                {t("drive.ui.context_menu.preview")}
              </ContextMenuItem>
            ))}

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("g.download")}</DropdownMenuLabel>

            <ContextMenuItem
              className="gap-x-2"
              onClick={() => akasha.item(selectedItems[0]).download()}
            >
              <GlobeIcon width={18} height={18} />
              {t("g.browser_download")}
            </ContextMenuItem>

            <ContextMenuItem
              className="gap-x-2"
              onClick={() => startAkashaDownloadForDesktop({ item: selectedItems[0] })}
            >
              <MonitorIcon width={18} height={18} />
              {t("g.desktop_download")}
            </ContextMenuItem>
          </DropdownMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuItem
            className="gap-x-2"
            onClick={() => {
              if (selectedItems[0]) {
                dialog.setOpen("shareDialog", true, {
                  id: selectedItems[0].id,
                });
              } else {
                toast.warning("선택된 항목이 없습니다");
              }
            }}
          >
            <Share2Icon width={18} height={18} />
            {t("drive.ui.context_menu.share")}
          </ContextMenuItem>

          <ContextMenuItem
            className="gap-x-2"
            onClick={() =>
              dialog.setOpen("notiDialog", true, {
                id: selectedItems[0].id,
              })
            }
          >
            <BellIcon />
            알림
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            className="gap-x-2"
            onClick={() =>
              dialog.setOpen("renameDialog", true, {
                id: selectedItems[0].id,
              })
            }
          >
            <SquarePenIcon width={18} height={18} />
            {t("drive.ui.rename")}
          </ContextMenuItem>
          <ContextMenuSeparator />

          <ContextMenuItem
            className="gap-x-2"
            onClick={() => {
              if (!selectedItems || selectedItems.length === 0) return;
              setCopyOrCuts("copy", selectedItems);
              if (selectedItems.length === 1) {
                toast.info(`"${selectedItems[0].name}"이(가) 복사 상태로 설정되었습니다`);
              } else {
                toast.info(
                  `"${selectedItems[0].name}"외 ${
                    selectedItems.length - 1
                  }개가 복사 상태로 설정되었습니다.`,
                );
              }
            }}
          >
            <CopyIcon width={18} height={18} />
            {t("drive.ui.context_menu.copy")}
          </ContextMenuItem>
          <ContextMenuItem className="gap-x-2" onClick={() => akasha.copyId(selectedItems[0])}>
            <CopyIcon width={18} height={18} />
            {t("drive.ui.context_menu.copy_id")}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}

      {selectedItems.every((item) => item.mimeType?.startsWith("image")) && (
        <ContextMenuItem className="cursor-pointer gap-x-2">
          <RotateCcwIcon width={18} height={18} />
          RG
        </ContextMenuItem>
      )}

      <ContextMenuItem
        className="gap-x-2"
        variant="destructive"
        onClick={() => trashMutation.mutate({ items: selectedItems })}
      >
        <Trash2Icon width={18} height={18} />
        {t("drive.ui.trash")}
      </ContextMenuItem>
    </>
  ) : (
    <ContextMenuItem
      className="cursor-pointer gap-x-2"
      onClick={() => dialog.setOpen("createDirDialog", true)}
    >
      <FolderIcon width={18} height={18} />
      {t("drive.ui.new_dir")}
    </ContextMenuItem>
  );
}

function ContextMenuLinkContentSnippet(
  props: ContextMenuContentSnippetProps & {
    link: { linkId: string; token: string };
    navi: (id: string) => void;
    session: Session | null;
  },
) {
  const { link, navi, session } = props;
  const { selectedItems } = useContentSelection();
  const { t } = useTranslation();
  const dialog = useDialogStore();

  return (
    <>
      {selectedItems.length === 1 ? (
        <>
          {selectedItems[0].isDir && (
            <>
              <ContextMenuItem className="gap-x-2" onClick={() => navi(selectedItems[0].id)}>
                <MousePointer2Icon width={18} height={18} />
                {t("drive.ui.context_menu.open")}
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuItem
                className="gap-x-2"
                onClick={() => {
                  dialog.setOpen("notiDialog", true, {
                    id: selectedItems[0].id,
                    link: {
                      id: link.linkId,
                      token: link.token,
                    },
                  });
                }}
              >
                <BellIcon width={18} height={18} />
                알림
              </ContextMenuItem>

              <ContextMenuSeparator />
            </>
          )}

          {(selectedItems[0].mimeType?.startsWith("text") ||
            selectedItems[0].mimeType?.startsWith("image")) && (
            <ContextMenuItem className="cugap-x-2">
              <EyeIcon width={18} height={18} />
              {t("drive.ui.context_menu.preview")}
            </ContextMenuItem>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("g.download")}</DropdownMenuLabel>
            <ContextMenuItem
              className="gap-x-2"
              onClick={() => akasha.item(selectedItems[0]).download(link)}
            >
              <GlobeIcon width={18} height={18} />
              {t("g.browser_download")}
            </ContextMenuItem>

            <ContextMenuItem
              className="gap-x-2"
              onClick={() => startAkashaDownloadForDesktop({ item: selectedItems[0], link })}
            >
              <MonitorIcon width={18} height={18} />
              {t("g.desktop_download")}
            </ContextMenuItem>
          </DropdownMenuGroup>

          {session && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem asChild>
                <ImportToMyDriveDialog of="link" content={selectedItems[0]} link={link} />
              </ContextMenuItem>
            </>
          )}
        </>
      ) : selectedItems.length > 1 ? (
        <></>
      ) : (
        <></>
      )}
    </>
  );
}

interface ContextMenuModContentSnippetProps extends ContextMenuContentSnippetProps {
  navi: (id: string) => void;
  session: Session | null;
}

function ContextMenuModContentSnippet({
  itemId,
  navi,
  session,
}: ContextMenuModContentSnippetProps) {
  const { t } = useTranslation();
  const { modQuery, itemQuery, sig, accessToken, collectionId, isOpenInfo } = useModContext();
  const { queryClient } = useRouteContext({ from: "__root__" });
  const { selectedItems } = useContentSelection();

  const own = modQuery?.permission.own || modQuery?.permission.sig;

  return (
    <>
      {selectedItems.length !== 0 ? (
        <>
          {selectedItems[0].isDir && (
            <>
              <ContextMenuItem className="gap-x-2" onClick={() => navi(selectedItems[0].id)}>
                <MousePointer2Icon width={18} height={18} />
                {t("drive.ui.context_menu.open")}
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          {selectedItems.length === 1 && selectedItems[0].isDir ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("g.download")}</DropdownMenuLabel>
                <ContextMenuItem
                  className="gap-x-2"
                  onClick={() =>
                    void startDownload({ items: selectedItems, token: accessToken, sig })
                  }
                >
                  <GlobeIcon width={18} height={18} />
                  {t("g.browser_download")}
                </ContextMenuItem>

                <ContextMenuItem
                  className="gap-x-2"
                  onClick={() =>
                    void startDownloadForDesktop({ items: selectedItems, token: accessToken, sig })
                  }
                >
                  <MonitorIcon width={18} height={18} />
                  {t("g.desktop_download")}
                </ContextMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {session && (
                <ContextMenuItem asChild>
                  <ImportToMyDriveDialog
                    of="mod"
                    content={selectedItems[0]}
                    modAccessToken={accessToken}
                    modSig={sig}
                  />
                </ContextMenuItem>
              )}
            </>
          ) : (
            <ContextMenuItem className="cursor-not-allowed gap-x-2 text-muted-foreground focus:text-muted-foreground">
              <XIcon width={18} height={18} />
              No Action
            </ContextMenuItem>
          )}

          {own && (
            <>
              <ContextMenuSeparator />

              <ContextMenuItem
                className="gap-x-2"
                onClick={async () => {
                  try {
                    await DeleteItem(selectedItems, sig);
                    await queryClient.refetchQueries({
                      queryKey: ["akasha", "mod", "item", itemId],
                    });
                  } catch (err) {
                    if (err instanceof Error && err.message === "invalid sig") {
                      toast.warning(err.message, {
                        description: "삭제할 수 있는 권한이 없습니다",
                      });
                      return;
                    }

                    toast.error(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                <DeleteIcon width={18} height={18} />
                Delete
              </ContextMenuItem>
            </>
          )}
        </>
      ) : (
        <ContextMenuItem className="cursor-not-allowed gap-x-2 text-muted-foreground focus:text-muted-foreground">
          <XIcon width={18} height={18} />
          No Action
        </ContextMenuItem>
      )}
    </>
  );
}
