import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  Delete as DeleteIcon,
  File as FileIcon,
  Folder as FolderIcon,
  Undo as RotateCcwIcon,
  Trash as TrashIcon,
} from "pixelarticons/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Center, ServerCrash } from "@/components/common";
import { AliceLoader } from "@/components/common/loaders";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { akasha, type Content, type SortType } from "@/lib/akasha";
import { eden } from "@/lib/eden";
import { cn, formatDate, formatSize } from "@/lib/utils";
import { naturalCompare } from "@/lib/utils/str-filter";

export const Route = createFileRoute("/akasha/drive/trash")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { queryClient } = useRouteContext({ from: "__root__" });

  const [sortType, setSortType] = useState<SortType>("NAME:ASC");
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["akasha:drive:trash"],
    queryFn: async () => {
      const { data, error } = await eden.akasha.content.trash.get();
      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
  });

  const sortedContents = useMemo(() => {
    if (!query.data) return [];

    return [...query.data].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;

      const [field, order] = sortType.split(":");
      const multiplier = order === "DESC" ? -1 : 1;

      switch (field) {
        case "NAME":
          return naturalCompare(a.name, b.name, multiplier);
        case "SIZE":
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return multiplier * ((Number(a.size) || 0) - (Number(b.size) || 0));
        case "DATE":
          return multiplier * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        default:
          return 0;
      }
    });
  }, [query.data, sortType]);

  const [selectedItems, setSelectedItems] = useState<Content[]>([]);

  const handleSort = (field: "NAME" | "SIZE" | "DATE") => {
    if (!sortType.startsWith(field)) {
      setSortType(`${field}:DESC`);
    } else if (sortType === `${field}:DESC`) {
      setSortType(`${field}:ASC`);
    } else {
      setSortType(`${field}:DESC`);
    }
  };

  const handleItemClick = async (item: Content, index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelections = sortedContents.slice(start, end + 1);

      if (event.metaKey || event.ctrlKey) {
        setSelectedItems(Array.from(new Set([...selectedItems, ...newSelections])));
      } else {
        setSelectedItems(newSelections);
      }
    } else if (event.metaKey || event.ctrlKey) {
      if (selectedItems.includes(item)) {
        setSelectedItems(selectedItems.filter((selected) => selected.id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
      setLastSelectedIndex(index);
    } else {
      setSelectedItems([item]);
      setLastSelectedIndex(index);
    }
  };

  const handleItemRightClick = async (e: React.MouseEvent, item: Content) => {
    // e.preventDefault();
    if (selectedItems.length <= 1) {
      setSelectedItems([item]);
    }
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    setSelectedItems([]);
    setLastSelectedIndex(null);
  };

  const refetcher = async () => {
    await queryClient.refetchQueries({
      queryKey: ["akasha:drive:trash"],
    });
  };

  if (query.isLoading) {
    return (
      <Center>
        <AliceLoader />
      </Center>
    );
  } else if (query.isError) {
    return (
      <Center>
        <ServerCrash />
      </Center>
    );
  } else if (query.data) {
    if (sortedContents.length >= 1) {
      return (
        <div className="flex h-full w-full flex-col select-none">
          <div className="flex flex-row text-sm">
            <div className="flex h-12 w-full flex-row items-center gap-3 px-3 pl-11 select-none md:h-8 md:pl-3">
              <div
                className="flex grow cursor-pointer flex-row items-center"
                onClick={() => handleSort("NAME")}
              >
                <div
                  className={cn(
                    "flex flex-row items-center gap-2",
                    sortType.startsWith("NAME") ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <p className="dragselect-start-disallowed line-clamp-1 text-ellipsis">이름</p>
                  {sortType === "NAME:DESC" ? (
                    <ArrowDownIcon width={16} height={16} />
                  ) : sortType === "NAME:ASC" ? (
                    <ArrowUpIcon width={16} height={16} />
                  ) : null}
                </div>
              </div>

              <div
                className="flex cursor-pointer flex-row items-center"
                onClick={() => handleSort("SIZE")}
              >
                <div
                  className={cn(
                    "flex flex-row items-center gap-2",
                    sortType.startsWith("SIZE") ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <p className="dragselect-start-disallowed line-clamp-1 text-ellipsis">크기</p>
                  {sortType === "SIZE:DESC" ? (
                    <ArrowDownIcon width={16} height={16} />
                  ) : sortType === "SIZE:ASC" ? (
                    <ArrowUpIcon width={16} height={16} />
                  ) : null}
                </div>
              </div>

              <div
                className="flex cursor-pointer flex-row items-center"
                onClick={() => handleSort("DATE")}
              >
                <div
                  className={cn(
                    "flex flex-row items-center gap-2",
                    sortType.startsWith("DATE") ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <p className="dragselect-start-disallowed line-clamp-1 text-ellipsis">날짜</p>
                  {sortType === "DATE:DESC" ? (
                    <ArrowDownIcon width={16} height={16} />
                  ) : sortType === "DATE:ASC" ? (
                    <ArrowUpIcon width={16} height={16} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <ContextMenu>
            <ContextMenuTrigger className="grow overflow-auto">
              <div className="h-full">
                <div className="flex h-full flex-1 flex-col">
                  {sortedContents.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer flex-row items-center gap-8 px-3 py-2 transition-colors duration-200 hover:bg-secondary",
                        selectedItems.some((selected) => selected.id === item.id) && "bg-secondary",
                      )}
                      onClick={(e) => handleItemClick(item, index, e)}
                      onContextMenu={(e) => handleItemRightClick(e, item)}
                    >
                      <div className="flex grow flex-row items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground">
                          {item.isDir ? (
                            <FolderIcon width={20} height={20} className="text-yellow-400" />
                          ) : (
                            <FileIcon width={20} height={20} className="text-blue-400" />
                          )}
                        </div>
                        <span className="line-clamp-1">{item.name}</span>
                      </div>

                      <div className="w-24 text-right text-sm text-muted-foreground">
                        {formatSize(Number(item.size))}
                      </div>

                      <div className="w-38 text-right text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  ))}

                  <div
                    className="grow"
                    onClick={handleClickOutside}
                    onContextMenu={handleClickOutside}
                  ></div>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="grow">
              {selectedItems.length !== 0 && (
                <>
                  <ContextMenuItem
                    className="cursor-pointer gap-x-2"
                    onClick={async () => {
                      const ids = selectedItems.map((item) => item.id);
                      try {
                        const res = await akasha.restoreMany(ids);
                        await refetcher();

                        if (res.length === 1) {
                          const { name, status } = res[0];
                          if (status === "restored") {
                            toast.success(t("#.itemsRestore.0", { values: { name } }));
                          } else if (status === "conflict") {
                            toast.warning(t("#.itemsRestore.1", { values: { name } }));
                          }
                        } else {
                          const successCount = res.filter(
                            (item) => item.status === "restored",
                          ).length;
                          const conflictCount = res.filter(
                            (item) => item.status === "conflict",
                          ).length;

                          const firstName = res[0].name;
                          if (successCount > 0 && conflictCount === 0) {
                            toast.success(
                              t("#.itemsRestore.2", {
                                values: { p1: firstName, p2: res.length.toString() },
                              }),
                            );
                          } else if (conflictCount > 0 && successCount === 0) {
                            toast.warning(
                              `${firstName}을 포함한 ${res.length}개가 동일한 이름을 가진 폴더 또는 디렉토리가 존재합니다`,
                            );
                          } else if (successCount > 0 && conflictCount > 0) {
                            toast.warning(
                              `${firstName} 외 ${conflictCount - 1}개가 동일한 이름을 가진 폴더 또는 디렉토리가 존재합니다`,
                            );
                          }
                        }
                      } catch (err) {
                        toast.error("Error", {
                          description: err instanceof Error ? err.message : String(err),
                        });
                      }
                    }}
                  >
                    <RotateCcwIcon width={18} height={18} />
                    복원
                  </ContextMenuItem>

                  <ContextMenuItem
                    className="cursor-pointer gap-x-2"
                    variant="destructive"
                    onClick={async () => {
                      const ids = selectedItems.map((i) => i.id);
                      try {
                        await akasha.deleteMany(ids);
                        await refetcher();
                        toast.success("Success");
                      } catch (err) {
                        toast.error("Error", {
                          description: err instanceof Error ? err.message : String(err),
                        });
                      }
                    }}
                  >
                    <DeleteIcon width={18} height={18} />
                    영구 삭제
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </div>
      );
    } else {
      return (
        <div className="flex h-full w-full flex-row items-center justify-center select-none">
          <div className="flex flex-col items-center justify-center p-4">
            <TrashIcon width={100} height={100} />
            <p className="mt-4 text-center text-xl">
              {t("drive.ui.no_trashed_content_section_message")}
            </p>
          </div>
        </div>
      );
    }
  }

  return null;
}
