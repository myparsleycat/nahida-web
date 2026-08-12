import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { Content, LayoutType, SortType } from "@/lib/akasha/types";

interface QueryParent {
    id: string;
    name: string;
}

interface QueryAncestor {
    id: string;
    parentId: string | null;
    name: string;
    depth: number;
}

interface QueryData {
    content: Content | null;
    parent: QueryParent | null;
    ancestors: QueryAncestor[];
    children: Content[];
}

interface QueryDataState {
    data: QueryData | undefined;
    setData: (data: QueryData | undefined) => void;
}

interface ContentSelectionState {
    selectedItems: Content[];
    setSelectedItems: (items: Content[]) => void;
    lastSelectedIdx: number | null;
    setLastSelectedIdx: (idx: number | null) => void;
    copyOrCuts: {
        action: "cut" | "copy" | null;
        items: Content[];
    };
    setCopyOrCuts: (action: "cut" | "copy" | null, items: Content[]) => void;
}

interface ContentDragState {
    uploadDragging: boolean;
    setUploadDragging: (dragging: boolean) => void;
    currentDragOver: Content | null;
    setCurrentDragOver: (content: Content | null) => void;
}

interface ContentViewState {
    layout: LayoutType;
    setLayout: (layout: LayoutType) => void;
    sortType: SortType;
    setSortType: (sortType: SortType) => void;
    searchInDirQuery: string;
    setSearchInDirQuery: (query: string) => void;
    includeSubdirs: boolean;
    setIncludeSubdirs: (includeSubdirs: boolean) => void;
    isfocusSearchInput: boolean;
    setFocusSearchInputState: (state: boolean) => void;
}

export const queryDataStore = createStore<QueryDataState>((set) => ({
    data: undefined,
    setData: (data) => set({ data }),
}));

export const contentSelectionStore = createStore<ContentSelectionState>((set) => ({
    selectedItems: [],
    setSelectedItems: (selectedItems) => set({ selectedItems }),
    lastSelectedIdx: null,
    setLastSelectedIdx: (lastSelectedIdx) => set({ lastSelectedIdx }),
    copyOrCuts: { action: null, items: [] },
    setCopyOrCuts: (action, items) => set({ copyOrCuts: { action, items } }),
}));

export const contentDragStore = createStore<ContentDragState>((set) => ({
    uploadDragging: false,
    setUploadDragging: (uploadDragging) => set({ uploadDragging }),
    currentDragOver: null,
    setCurrentDragOver: (currentDragOver) => set({ currentDragOver }),
}));

export const contentViewStore = createStore<ContentViewState>((set) => ({
    layout: "list",
    setLayout: (layout) => set({ layout }),
    sortType: "NAME:ASC",
    setSortType: (sortType) => set({ sortType }),
    searchInDirQuery: "",
    setSearchInDirQuery: (searchInDirQuery) => set({ searchInDirQuery }),
    includeSubdirs: false,
    setIncludeSubdirs: (includeSubdirs) => set({ includeSubdirs }),
    isfocusSearchInput: false,
    setFocusSearchInputState: (isfocusSearchInput) => set({ isfocusSearchInput }),
}));

export const useQueryData = () => useStore(queryDataStore);
export const useContentSelection = () => useStore(contentSelectionStore);
export const useContentDrag = () => useStore(contentDragStore);
export const useContentView = () => useStore(contentViewStore);
