import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { akasha, dialogStore, type Content } from "@/lib/akasha";
import { GetFSEntries } from "@/lib/akasha/services/drive-upload";
import { startUpload } from "@/lib/akasha/services/mod-drive/upload";
import { formatUploadTransferSummary } from "@/lib/akasha/upload-v2/format";
import { summarizeUploadTargets } from "@/lib/akasha/upload-v2/policy";
import { loadUploadSessionSnapshot } from "@/lib/akasha/upload-v2/repository";
import { eden } from "@/lib/eden";
import {
    contentDragStore,
    useContentDrag,
    useContentSelection,
} from "@/stores/akasha-content.store";

export {
    contentDragStore,
    contentSelectionStore,
    contentViewStore,
    queryDataStore,
    useContentDrag,
    useContentSelection,
    useContentView,
    useQueryData,
} from "@/stores/akasha-content.store";

export function useContentMenu(sortedContents?: Content[]) {
    const dialog = dialogStore.getState();
    const navi = useNavigate();
    const selection = useContentSelection();
    const { currentDragOver } = contentDragStore.getState();

    const handleItemClick = async (item: Content, index: number, event: React.MouseEvent) => {
        if (event.shiftKey && selection.lastSelectedIdx !== null && sortedContents) {
            const start = Math.min(selection.lastSelectedIdx, index);
            const end = Math.max(selection.lastSelectedIdx, index);
            const newSelections = sortedContents.slice(start, end + 1);

            if (event.metaKey || event.ctrlKey) {
                selection.setSelectedItems(
                    Array.from(new Set([...selection.selectedItems, ...newSelections])),
                );
            } else {
                selection.setSelectedItems(newSelections);
            }
        } else if (event.metaKey || event.ctrlKey) {
            if (selection.selectedItems.includes(item)) {
                selection.setSelectedItems(
                    selection.selectedItems.filter((selected) => selected.id !== item.id),
                );
            } else {
                selection.setSelectedItems([...selection.selectedItems, item]);
            }
            selection.setLastSelectedIdx(index);
        } else {
            selection.setSelectedItems([item]);
            selection.setLastSelectedIdx(index);
        }
    };

    const handleItemRightClick = async (_e: React.MouseEvent, item: Content) => {
        if (selection.selectedItems.length <= 1) {
            selection.setSelectedItems([item]);
        }
    };

    const handleClickOutside = (_e: React.MouseEvent) => {
        selection.setSelectedItems([]);
        selection.setLastSelectedIdx(null);
    };

    const handleItemDoubleClick = async (item: Content, navi2?: (str: string) => void) => {
        if (item.isDir) {
            if (navi2) {
                navi2(item.id);
            } else {
                await navi({ to: "/akasha/drive/$itemId", params: { itemId: item.id } });
            }
        } else {
            if (item.mimeType?.startsWith("text")) {
                // textViewerStore.openTextViewer(item);
            } else {
                await akasha.item(item).download();
            }
        }
    };

    const getDoubleClickHandler = (item: Content, navi?: (str: string) => void) => () => {
        if (!dialog.anyDialogOpen()) {
            void handleItemDoubleClick(item, navi).catch((error) => {
                console.error("Failed to handle double click:", error);
            });
        }
    };

    return {
        dialog,
        selection,
        currentDragOver,
        handleItemClick,
        handleItemRightClick,
        handleClickOutside,
        getDoubleClickHandler,
    };
}

interface moveMutationProps {
    items: Content[];
    targetId: string;
    current: string;
}

interface copyMutationProps {
    items: Content[];
    targetId: string;
}

export function useAkashaMutation() {
    const moveMutation = useMutation({
        mutationKey: ["akasha", "drive", "move"],
        mutationFn: async (props: moveMutationProps) => {
            const { items, targetId } = props;
            const uuids = items.map((item) => item.id);

            const { data, error } = await eden.akasha.content.move_many.post({
                uuids,
                target: targetId,
            });
            if (error) {
                throw new Error(toErrorText(error.value));
            }

            return data;
        },
    });

    const copyMutation = useMutation({
        mutationKey: ["akasha", "drive", "copy"],
        mutationFn: async (props: copyMutationProps) => {
            const { items, targetId } = props;
            const uuids = items.map((item) => item.id);

            const { data, error } = await eden.akasha.content.copy_many.post({
                uuids,
                target: targetId,
            });
            if (error) {
                throw new Error(toErrorText(error.value));
            }

            return data;
        },
    });

    return {
        moveMutation,
        copyMutation,
    };
}

function toErrorText(value: unknown) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "message" in value) return String(value.message);
    return "request_failed";
}

export function useHandler() {
    const drag = useContentDrag();
    const { t } = useTranslation();
    const { queryClient } = useRouteContext({ from: "__root__" });

    const onDragEnter = (e: React.DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            drag.setUploadDragging(true);
        }
    };

    const onDragLeave = (e: React.DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            drag.setUploadDragging(false);
        }

        drag.setCurrentDragOver(null);
    };

    const onDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            drag.setUploadDragging(true);
        }
    };

    const onDrop = async ({
        e,
        of,
        rawContents,
        itemId,
        collectionId,
        sig,
    }: {
        e: React.DragEvent;
        of: "drive" | "mod";
        rawContents: Content[];
        itemId: string;
        collectionId?: string;
        sig?: string;
    }) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();

        const items = e.dataTransfer?.items;
        if (!items) return;

        const entries = GetFSEntries(items);

        try {
            if (of === "drive") {
                await akasha.uploadFromEntries(rawContents, entries, itemId);
            } else if (of === "mod" && collectionId) {
                const requestId = await startUpload({
                    items: rawContents,
                    entries,
                    current: itemId,
                    collectionId,
                    sig,
                });

                const snapshot = await loadUploadSessionSnapshot(requestId);
                if (snapshot?.session.status === "failed") {
                    throw new Error(
                        snapshot.session.errorCode ??
                            snapshot.session.reason ??
                            "upload_plan_failed",
                    );
                }
                const summary = summarizeUploadTargets(snapshot?.targets ?? []);
                const description = formatUploadTransferSummary(summary, t);
                const successful = snapshot?.session.status === "completed";
                toast[successful ? "success" : "warning"](
                    t(
                        successful
                            ? "upload.transfer.status.completed"
                            : `upload.transfer.status.${snapshot?.session.status ?? "partial"}`,
                    ),
                    description ? { description } : undefined,
                );

                await queryClient.refetchQueries({
                    queryKey: ["akasha", "mod", "item", itemId],
                });
            } else {
                throw new Error("invalid props");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "upload_failed";
            if (message === "invalid_sig") {
                toast.error(message, {
                    description: "권한이 없거나 키가 누락되었습니다",
                });
                return;
            }

            console.error("Error during upload process:", err);
            toast.error("Failed to process upload", {
                description: t(`upload.transfer.reason.${message}`, { defaultValue: message }),
            });
        } finally {
            drag.setUploadDragging(false);
        }
    };

    return {
        onDragEnter,
        onDragLeave,
        onDragOver,
        onDrop,
    };
}
