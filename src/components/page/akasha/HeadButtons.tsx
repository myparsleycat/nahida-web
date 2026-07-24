import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import {
  WarningDiamond as AlertCircleIcon,
  Bell as BellIcon,
  Check as CheckCircle2Icon,
  Download as DownloadIcon,
  Folder as FolderIcon,
  Globe as GlobeIcon,
  Open as ImportIcon,
  Grid3x3 as LayoutGridIcon,
  Bulletlist as ListIcon,
  Loader as Loader2Icon,
  Monitor as MonitorIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
} from "pixelarticons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AkashaModData } from "@/lib/akasha/services/drive-types";

import {
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useContentView } from "@/hooks/akasha";
import { akasha, useDialogStore, type Content } from "@/lib/akasha";
import { startAkashaDownloadForDesktop } from "@/lib/akasha/services/drive-download";
import { startDownload, startDownloadForDesktop } from "@/lib/akasha/services/mod-drive/download";
import { useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";
import { cn, formatSize } from "@/lib/utils";

import type { ImportEvent } from "./types";

import { ProcessSheet } from "./ProcessSheet";

interface AkashaHeadButtonsProps {
  of: "drive" | "link" | "mod";
  content: Content;
  link?: {
    linkId: string;
    token: string;
  };
  modQuery?: AkashaModData | null;
}

export function AkashaHeadButtons(props: AkashaHeadButtonsProps) {
  const { of, content, link, modQuery } = props;
  const { t } = useTranslation();
  const dialog = useDialogStore();
  const view = useContentView();
  const { data: session } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);

  async function handleDownload() {
    if (of === "link" && !link) return;

    if (content.size && content.size > 100 * 1024 * 1024 * 1024) {
      toast.warning(t("toast.browser_download_too_large.title"), {
        description: t("toast.browser_download_too_large.description"),
      });
      return;
    }

    try {
      if (of === "mod") {
        startDownload({ mod: modQuery, items: [content] });
        return;
      }

      await akasha.item(content).download(link);
    } catch (err: any) {
      console.error("handleDownload Error", err);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 md:ml-4 md:gap-3">
        <div className="relative hidden w-full md:block">
          <SearchIcon className="absolute top-2 left-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
          <Input
            className="w-50 pl-8 dark:bg-transparent"
            placeholder={t("drive.ui.search_in_dir_placeholder")}
            value={view.searchInDirQuery}
            onValueChange={view.setSearchInDirQuery}
            onFocus={() => view.setFocusSearchInputState(true)}
            onBlur={() => view.setFocusSearchInputState(false)}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label={t("drive.ui.search_in_dir_placeholder")}
        >
          <SearchIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (view.layout === "grid") {
              view.setLayout("list");
            } else {
              view.setLayout("grid");
            }
          }}
        >
          {view.layout === "grid" ? (
            <ListIcon />
          ) : view.layout === "list" ? (
            <LayoutGridIcon />
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <DownloadIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("g.download")}</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleDownload}>
                <GlobeIcon width={18} height={18} />
                {t("g.browser_download")}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async () => {
                  if (of === "mod") {
                    await startDownloadForDesktop({
                      items: [content],
                      suggestedName: modQuery?.mod.title,
                    });
                  } else if (of === "drive") {
                    await startAkashaDownloadForDesktop({ item: content });
                  } else {
                    await startAkashaDownloadForDesktop({ item: content, link });
                  }
                }}
              >
                <MonitorIcon width={18} height={18} />
                {t("g.desktop_download")}
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {session && of !== "drive" && (
              <DropdownMenuItem asChild>
                <ImportToMyDriveDialog of={of} content={content} link={link} />
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {session && of !== "mod" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              dialog.setOpen("notiDialog", true, {
                id: content.id,
                ...(link && {
                  link: {
                    id: link.linkId,
                    token: link.token,
                  },
                }),
              });
            }}
          >
            <BellIcon />
          </Button>
        )}

        {of === "link" && <ProcessSheet variants="ghost" />}

        {of === "drive" && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:h-9 md:px-3")}
            >
              <PlusIcon className="md:hidden" />
              <span className="hidden md:inline">{t("g.make_new")}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="cursor-pointer gap-3"
                onClick={() => dialog.setOpen("createDirDialog", true)}
              >
                <FolderIcon width={20} height={20} />
                {t("drive.ui.new_dir")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer gap-3">
                  <UploadIcon width={20} height={20} />
                  {t("drive.upload_dir")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-3">
                  <UploadIcon width={20} height={20} />
                  {t("drive.upload_file")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {searchOpen && (
        <div className="relative w-full md:hidden">
          <SearchIcon className="absolute top-2 left-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
          <Input
            className="w-full pl-8 dark:bg-transparent"
            placeholder={t("drive.ui.search_in_dir_placeholder")}
            value={view.searchInDirQuery}
            onValueChange={view.setSearchInDirQuery}
            onFocus={() => view.setFocusSearchInputState(true)}
            onBlur={() => view.setFocusSearchInputState(false)}
          />
        </div>
      )}
    </>
  );
}

interface ImportToMyDriveDialogProps {
  of: "drive" | "link" | "mod";
  content: Content;
  link?: {
    linkId: string;
    token: string;
  };
  modQuery?: AkashaModData | null;
}

type ImportStatusType = "init" | "updating_metadata";

interface ImportProgressData {
  depth: number;
  processedDirs: number;
  processedFiles: number;
  currentTotalSize: number;
  batchIndex: number;
  totalBatchesInDepth: number;
}

interface ImportCompleteData {
  status: "success";
  totalSize: number;
  totalFiles: number;
  totalDirs: number;
}

export function ImportToMyDriveDialog({ of, content, link }: ImportToMyDriveDialogProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();

  type FolderItem = {
    id: string;
    name: string;
    isDir: boolean;
  };

  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<{ id: string; name: string }[]>([
    { id: session!.drive!.rootId, name: "root" },
  ]);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<
    "idle" | ImportStatusType | "processing" | "complete" | "error" | "updating_metadata"
  >("idle");
  const [progress, setProgress] = useState<
    (ImportProgressData & { totalExpectedSize?: number }) | null
  >(null);
  const [totalExpectedSize, setTotalExpectedSize] = useState<number>(0);
  const [completeData, setCompleteData] = useState<ImportCompleteData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentFolder = path[path.length - 1];
  const isImporting = status !== "idle";

  useEffect(() => {
    if (open && status === "idle") {
      setPath([{ id: session!.drive!.rootId, name: "root" }]);
    }
  }, [open, status]);

  useEffect(() => {
    const getFolderChildren = async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await eden.akasha.content({ id }).get();
        if (error) throw new Error(error.value.toString() || "Unknown Error");

        const folders = data.children.filter((item: FolderItem) => item.isDir);
        const sortedFolders = folders.sort((a, b) => a.name.localeCompare(b.name));
        setItems(sortedFolders);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    if (currentFolder?.id && open && status === "idle") {
      getFolderChildren(currentFolder.id);
    }
  }, [currentFolder, open, status]);

  const handleFolderClick = (folder: FolderItem) => {
    setPath((prevPath) => [...prevPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath((prevPath) => prevPath.slice(0, index + 1));
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStatus("idle");
      setProgress(null);
      setTotalExpectedSize(0);
      setCompleteData(null);
      setErrorMessage(null);
    }, 300);
  };

  const handleImport = async () => {
    if (!currentFolder) {
      toast.warning("대상 폴더가 선택되지 않았습니다");
      return;
    }

    setStatus("init");
    setProgress(null);
    setTotalExpectedSize(0);
    setCompleteData(null);
    setErrorMessage(null);

    try {
      const { data: stream, error } = await eden.akasha.common.sse.import.get({
        query: {
          mode: of,
          src: content.id,
          dest: currentFolder.id,
          ...(link && { linkId: link.linkId, linkToken: link.token }),
        },
      });

      if (error) throw new Error(error.value?.toString() || "요청 실패");

      if (stream && typeof stream === "object" && Symbol.asyncIterator in stream) {
        for await (const chunk of stream as AsyncIterable<ImportEvent>) {
          switch (chunk.event) {
            case "metadata":
              setTotalExpectedSize(chunk.data.totalExpectedSize);
              break;

            case "status":
              setStatus(chunk.data as any);
              break;

            case "progress":
              setStatus("processing");
              setProgress(chunk.data);
              break;

            case "complete":
              setStatus("complete");
              setCompleteData(chunk.data);
              break;

            case "error":
              throw new Error(chunk.data);
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "가져오기 실패");
    }
  };

  const currentSize = progress?.currentTotalSize ?? completeData?.totalSize ?? 0;
  const progressPercent =
    totalExpectedSize > 0 ? Math.min(Math.round((currentSize / totalExpectedSize) * 100), 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (isImporting && !val) return;
        setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="relative flex w-full cursor-pointer items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
        >
          <ImportIcon width={18} height={18} className="text-muted-foreground" />
          {t("drive.ui.import_to_drive")}
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={!isImporting}
        onPointerDownOutside={(e) => isImporting && e.preventDefault()}
        onEscapeKeyDown={(e) => isImporting && e.preventDefault()}
        className={cn("flex flex-col", !isImporting && "h-[60vh] min-h-75 sm:max-w-106.25")}
      >
        <DialogHeader>
          <DialogTitle>
            {isImporting
              ? status === "complete"
                ? "가져오기 완료"
                : status === "error"
                  ? "오류 발생"
                  : "가져오기 진행 중"
              : t("drive.ui.import_to_drive")}
          </DialogTitle>
        </DialogHeader>

        {!isImporting ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b pb-2 text-sm text-muted-foreground">
              {path.map((p, index) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className="hover:underline disabled:cursor-text disabled:no-underline"
                    disabled={index === path.length - 1}
                  >
                    {p.name}
                  </button>
                  {index < path.length - 1 && <span className="text-gray-400">/</span>}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2Icon className="animate-spin" />
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center text-sm text-red-500">
                  {error}
                </div>
              ) : items.length > 0 ? (
                <div className="flex flex-col space-y-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleFolderClick(item)}
                      className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
                    >
                      <FolderIcon className="size-4 text-muted-foreground" />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("drive.ui.no_contents_section_message.0")}
                </div>
              )}
            </div>

            <DialogFooter className="mt-auto pt-4">
              <DialogClose asChild>
                <Button variant="outline">{t("g.cancel")}</Button>
              </DialogClose>
              <Button onClick={handleImport}>
                {t("drive.ui.import_to_here", { folderName: currentFolder.name })}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center gap-4 text-center">
                {status === "complete" ? (
                  <CheckCircle2Icon className="size-12 text-green-500" />
                ) : status === "error" ? (
                  <AlertCircleIcon className="size-12 text-destructive" />
                ) : (
                  <Loader2Icon className="size-12 animate-spin text-primary" />
                )}

                <div className="space-y-1">
                  <h3 className="text-lg font-medium">
                    {status === "complete"
                      ? "모든 항목을 가져왔습니다"
                      : status === "error"
                        ? "가져오기에 실패했습니다"
                        : "데이터를 내 드라이브로 복사 중입니다"}
                  </h3>
                  {status === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}
                </div>
              </div>

              {status !== "error" && (
                <div className="mx-auto w-full max-w-sm space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="mb-1 text-xs text-muted-foreground">폴더 / 파일</p>
                      <p className="font-semibold text-foreground">
                        {progress?.processedDirs ?? completeData?.totalDirs ?? 0} /{" "}
                        {progress?.processedFiles ?? completeData?.totalFiles ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="mb-1 text-xs text-muted-foreground">진행 용량</p>
                      <p className="font-semibold text-foreground">
                        {formatSize(currentSize)}
                        {totalExpectedSize > 0 && ` / ${formatSize(totalExpectedSize)}`}
                      </p>
                    </div>
                  </div>

                  {(status === "processing" || status === "init") && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {status === "init"
                            ? "준비 중..."
                            : `복사 중... (Depth ${progress?.depth ?? 0})`}
                        </span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{
                            width: `${progressPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {status === "updating_metadata" && (
                    <p className="animate-pulse text-center text-xs text-muted-foreground">
                      최종 용량 계산 및 메타데이터 업데이트 중...
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-auto pt-4">
              {(status === "complete" || status === "error") && (
                <Button
                  className="w-full"
                  onClick={() => {
                    handleClose();
                  }}
                >
                  {status === "complete" ? "확인" : "닫기"}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
