import { useNavigate, useParams, useRouteContext } from "@tanstack/react-router";
import { fileTypeFromBuffer } from "file-type";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Content } from "@/lib/akasha";

import {
  useContentSelection,
  useContentView,
  useAkashaMutation,
  useQueryData,
} from "@/hooks/akasha";
import { akasha, useDialogStore } from "@/lib/akasha";
import { getImageFromClipboard } from "@/lib/utils";

interface HandlerProviderProps {
  children: React.ReactNode;
  sortedContents: Content[];
}

export function HandlerProvider(props: HandlerProviderProps) {
  const { children, sortedContents } = props;
  const navi = useNavigate();
  const dialog = useDialogStore();
  const { selectedItems, setSelectedItems, setLastSelectedIdx, copyOrCuts, setCopyOrCuts } =
    useContentSelection();
  const { isfocusSearchInput } = useContentView();
  const query = useQueryData();
  const mutation = useAkashaMutation();
  const param = useParams({ from: "/akasha/drive/$itemId" });
  const { t } = useTranslation();
  const { queryClient } = useRouteContext({ from: "__root__" });

  const searchBuffer = useRef("");
  const searchTimeout = useRef<number | undefined>(undefined);

  const resetSearchBuffer = () => {
    searchBuffer.current = "";
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = undefined;
    }
  };

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") return;
      if (isfocusSearchInput) return;
      if (dialog.anyDialogOpen()) return;

      const currentIndex = selectedItems.length
        ? sortedContents.findIndex((item) => item.id === selectedItems[0]?.id)
        : -1;

      if (e.key === "F2") {
        e.preventDefault();

        if (!selectedItems || selectedItems.length === 0 || selectedItems.length > 1) return;

        dialog.setOpen("renameDialog", true);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
          if (currentIndex !== -1 && sortedContents[currentIndex]?.isDir) {
            navi({
              to: "/akasha/drive/$itemId",
              params: { itemId: sortedContents[currentIndex].id },
            });
          }
        } else {
          const nextIndex = Math.min(currentIndex + 1, sortedContents.length - 1);
          setSelectedItems([sortedContents[nextIndex]]);
          setLastSelectedIdx(nextIndex);

          const element = document.getElementById(sortedContents[nextIndex]?.id);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
          if (query.data?.parent) {
            navi({
              to: "/akasha/drive/$itemId",
              params: {
                itemId: query.data.parent.id,
              },
            });
          } else {
            toast.warning("상위 폴더가 없습니다.");
          }
        } else {
          const prevIndex = Math.max(currentIndex - 1, 0);
          setSelectedItems([sortedContents[prevIndex]]);
          setLastSelectedIdx(prevIndex);

          const element = document.getElementById(sortedContents[prevIndex]?.id);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }

      if (/^[a-zA-Z0-9]$/.test(e.key) && !(e.ctrlKey || e.metaKey)) {
        e.preventDefault();

        const pressedKey = e.key.toLowerCase();

        searchBuffer.current += pressedKey;

        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current);
        }
        searchTimeout.current = window.setTimeout(() => {
          resetSearchBuffer();
        }, 500);

        const firstMatchedItem = sortedContents.find((item) =>
          item.name.toLowerCase().startsWith(searchBuffer.current),
        );

        if (firstMatchedItem) {
          setSelectedItems([firstMatchedItem]);
          setLastSelectedIdx(sortedContents.indexOf(firstMatchedItem));

          const element = document.querySelector(`[data-uuid="${firstMatchedItem.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();

        setSelectedItems([]);
        setLastSelectedIdx(null);
        setCopyOrCuts(null, []);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (query.data?.children) {
          setSelectedItems(query.data.children);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        if (selectedItems.length >= 1) {
          toast.warning("복사는 지원하지 않습니다");
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        setCopyOrCuts("cut", selectedItems);
        if (selectedItems.length === 1) {
          toast.info(`"${selectedItems[0].name}"이(가) 잘라내기 상태로 설정되었습니다`);
        } else if (selectedItems.length > 1) {
          toast.info(
            `"${copyOrCuts.items[0].name}"외 ${
              copyOrCuts.items.length - 1
            }개가 잘라내기 상태로 설정되었습니다.`,
          );
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        if (copyOrCuts.action && copyOrCuts.items.length > 0) {
          if (copyOrCuts.action === "cut") {
            const itemsToMove = [...copyOrCuts.items];

            setCopyOrCuts(null, []);

            const promise = mutation.moveMutation.mutateAsync({
              items: itemsToMove,
              targetId: param.itemId,
              current: param.itemId,
            });

            toast.promise(promise, {
              loading: `${t("#.moveItems.toast-promise.loading")}`,
              success: () => {
                queryClient.refetchQueries({
                  queryKey: ["akasha", "drive", "item"],
                });
                return `${t("#.moveItems.toast-promise.success")}`;
              },
              error: (err: any) =>
                `${t("#.moveItems.toast-promise.error", { values: { error: err.message } })}`,
            });
          }
        } else {
          const file = await getImageFromClipboard();
          if (!file) return;

          const currentParentId = window.location.href.split("/").pop();
          if (!currentParentId) {
            toast.warning("현재 폴더 ID를 가져오는데 실패했어요");
            return;
          }

          const processName = `붙여넣기 작업`;

          const arrbuf = await file.arrayBuffer();
          const ext = (await fileTypeFromBuffer(arrbuf))?.ext;

          const f = {
            FID: nanoid(),
            path: "",
            name: `preview.${ext}`,
            size: file.size,
            parentPath: "",
            file,
          };

          akasha.ULProcess.enqueueUpload({
            files: [f],
            directories: [],
            parentUUID: currentParentId,
            name: processName,
            size: file.size,
            totalItems: 1,
          });
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        dialog.searchCommand.open = !dialog.searchCommand.open;
      }
    },
    [
      sortedContents,
      selectedItems,
      isfocusSearchInput,
      copyOrCuts,
      query.data,
      navi,
      dialog,
      setSelectedItems,
      setLastSelectedIdx,
      setCopyOrCuts,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return <>{children}</>;
}
