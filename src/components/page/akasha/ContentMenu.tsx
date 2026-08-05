import {
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  File as FileIcon,
  FileText as FileTextIcon,
  Folder as FolderIcon,
  Loader as LoaderIcon,
} from "pixelarticons/react";
import { useTranslation } from "react-i18next";

import type { Content } from "@/lib/akasha";

import { useContextMenuData } from "@/context/ContextMenuContext";
import { useContentView, useContentMenu } from "@/hooks/akasha";
import i18n from "@/lib/i18n";
import { cn, formatDate, formatSize } from "@/lib/utils";

import { PreviewModal } from "./PreviewModal";

interface ContentMenuProps {
  sortedContents: Content[];
  isFetching: boolean;
  itemId: string;
}

export function ListHead() {
  const view = useContentView();
  const { t } = useTranslation();

  const handleSort = (field: "NAME" | "SIZE" | "DATE") => {
    if (!view.sortType.startsWith(field)) {
      view.setSortType(`${field}:DESC`);
    } else if (view.sortType === `${field}:DESC`) {
      view.setSortType(`${field}:ASC`);
    } else {
      view.setSortType(`${field}:DESC`);
    }
  };

  return (
    <table className="w-full table-fixed border-collapse">
      <ContentColumns />
      <thead className="bg-background text-sm">
        <tr className="h-8">
          <th className="pl-3 text-left align-middle font-normal">
            <button
              className="flex w-full flex-row items-center justify-start"
              onClick={() => handleSort("NAME")}
            >
              <div
                className={cn(
                  "flex flex-row items-center gap-2",
                  view.sortType.startsWith("NAME") ? "text-primary" : "text-muted-foreground",
                )}
              >
                <p className="dragselect-start-disallowed whitespace-nowrap">
                  {t("drive.ui.name")}
                </p>
                {view.sortType === "NAME:DESC" && <ArrowDownIcon width={16} height={16} />}
                {view.sortType === "NAME:ASC" && <ArrowUpIcon width={16} height={16} />}
              </div>
            </button>
          </th>

          <th className="px-2 align-middle font-normal whitespace-nowrap">
            <button
              className="flex w-full flex-row items-center justify-end"
              onClick={() => handleSort("SIZE")}
            >
              <div
                className={cn(
                  "flex flex-row items-center justify-end gap-2",
                  view.sortType.startsWith("SIZE") ? "text-primary" : "text-muted-foreground",
                )}
              >
                <p className="dragselect-start-disallowed whitespace-nowrap">
                  {t("drive.ui.size")}
                </p>
                {view.sortType === "SIZE:DESC" && <ArrowDownIcon width={16} height={16} />}
                {view.sortType === "SIZE:ASC" && <ArrowUpIcon width={16} height={16} />}
              </div>
            </button>
          </th>

          <th className="pr-3 align-middle font-normal whitespace-nowrap">
            <button
              className="flex w-full flex-row items-center justify-end"
              onClick={() => handleSort("DATE")}
            >
              <div
                className={cn(
                  "flex flex-row items-center justify-end gap-2",
                  view.sortType.startsWith("DATE") ? "text-primary" : "text-muted-foreground",
                )}
              >
                <p className="dragselect-start-disallowed whitespace-nowrap">
                  {t("drive.ui.date")}
                </p>
                {view.sortType === "DATE:DESC" && <ArrowDownIcon width={16} height={16} />}
                {view.sortType === "DATE:ASC" && <ArrowUpIcon width={16} height={16} />}
              </div>
            </button>
          </th>
        </tr>
      </thead>
    </table>
  );
}

function ContentColumns() {
  return (
    <colgroup>
      <col />
      <col className="w-24" />
      <col className="w-52" />
    </colgroup>
  );
}

export function ContentMenuList(props: ContentMenuProps) {
  const { sortedContents, isFetching, itemId } = props;
  const { navi } = useContextMenuData();
  const {
    selection,
    currentDragOver,
    handleItemClick,
    handleItemRightClick,
    handleClickOutside,
    getDoubleClickHandler,
  } = useContentMenu(sortedContents);

  return (
    <>
      <table className="w-full table-fixed border-collapse">
        <ContentColumns />
        <tbody>
          {sortedContents.map((item, idx) => (
            <tr
              key={item.id}
              data-uuid={item.id}
              className={cn(
                "sorted-contents cursor-pointer border-b border-transparent hover:bg-black/10 hover:dark:bg-white/10",
                selection.selectedItems.some((selected) => selected.id === item.id) &&
                  "bg-black/10 dark:bg-white/10",
                currentDragOver?.id === item.id && "bg-black/10 dark:bg-white/10",
              )}
              draggable="true"
              onClick={(e) => handleItemClick(item, idx, e)}
              onDoubleClick={getDoubleClickHandler(item, navi)}
              onContextMenu={(e) => handleItemRightClick(e, item)}
            >
              <td className="p-2 pl-3 text-left align-middle">
                <div className="flex flex-row items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
                    {isFetching && itemId === item.id ? (
                      <LoaderIcon className="animate-spin-1.5" width={20} height={20} />
                    ) : item.isDir && !item.preview ? (
                      <FolderIcon className="h-full w-full text-yellow-400" />
                    ) : item.preview ? (
                      <PreviewModal
                        className="w-12"
                        preview={item.preview}
                        alt={item.name}
                        type="list"
                      />
                    ) : item.mimeType?.startsWith("text") ? (
                      <FileTextIcon className="h-full w-full text-blue-400" />
                    ) : (
                      <FileIcon className="h-full w-full" />
                    )}
                  </div>
                  <span className="block truncate text-left">{item.name}</span>
                </div>
              </td>

              <td className="p-2 text-right align-middle text-sm whitespace-nowrap text-muted-foreground">
                {formatSize(Number(item.size))}
              </td>
              <td className="p-2 pr-3 text-right align-middle text-sm whitespace-nowrap text-muted-foreground">
                {formatDate(item.updatedAt, i18n.language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div onClick={handleClickOutside} onContextMenu={handleClickOutside}></div>
    </>
  );
}

export function ContentMenuGrid(props: ContentMenuProps) {
  const { sortedContents, isFetching } = props;
  const { itemId, navi } = useContextMenuData();
  const { selection, handleItemClick, handleItemRightClick, getDoubleClickHandler } =
    useContentMenu(sortedContents);

  return (
    <div className="grid grid-cols-2 gap-4 p-4 pr-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {sortedContents.map((item, idx) => (
        <div
          key={item.id}
          data-uuid={item.id}
          className={cn(
            "sorted-contents cursor-pointer rounded-sm border p-2 hover:bg-secondary",
            selection.selectedItems.some((selected) => selected.id === item.id) && "bg-secondary",
          )}
          draggable="true"
          onClick={(e) => handleItemClick(item, idx, e)}
          onDoubleClick={getDoubleClickHandler(item, navi)}
          onContextMenu={(e) => handleItemRightClick(e, item)}
        >
          <div className="relative flex aspect-square items-center justify-center">
            {isFetching && itemId === item.id ? (
              <LoaderIcon className="animate-spin-1.5" width={32} height={32} />
            ) : item.isDir && !item.preview ? (
              <FolderIcon className="p-4 text-yellow-400" width={100} height={100} />
            ) : item.preview?.video ? (
              <video
                src={item.preview.video.default}
                className="relative h-full w-full object-contain"
                draggable="false"
                muted
                autoPlay
                loop
                controls={false}
              />
            ) : item.preview?.img ? (
              <img
                className="relative h-full w-full object-contain"
                src={item.preview.img.cover || item.preview.img.default}
                alt={item.name}
                loading="lazy"
              />
            ) : (
              <FileIcon className="text-blue-400" width={32} height={32} />
            )}

            <div className="absolute bottom-0 left-1/2 flex w-full -translate-x-1/2 flex-row items-center justify-center">
              <div className="flex h-full flex-row items-center justify-center gap-2 rounded-full bg-zinc-100 px-2 py-0.75 dark:bg-zinc-900">
                <p className="dragselect-start-disallowed line-clamp-1 text-sm break-all text-ellipsis text-primary">
                  {item.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
