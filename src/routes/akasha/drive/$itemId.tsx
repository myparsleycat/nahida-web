import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Folder as FolderIcon } from "pixelarticons/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import type { Content } from "@/lib/akasha";

import { AliceLoader, Center, ServerCrash } from "@/components/common";
import {
  AkashaBreadcrumb,
  AkashaHeadButtons,
  AkashaSkeleton,
  ContentMenuGrid,
  ContentMenuList,
  ContextMenuProvider,
  HandlerProvider,
  ListHead,
} from "@/components/page/akasha";
import { NewDirectoryDialog, PubLinkDialog, RenameDialog } from "@/components/page/akasha/dialogs";
import { Button } from "@/components/ui/button";
import { useContentDrag, useContentView, useHandler, useQueryData } from "@/hooks/akasha";
import { eden } from "@/lib/eden";
import { getChosung, getSearchScore } from "@/lib/sejong";
import { commonSort } from "@/lib/utils";

const routeSearchSchema = z.object({
  did: z.optional(z.string()),
});

export const Route = createFileRoute("/akasha/drive/$itemId")({
  component: RouteComponent,
  validateSearch: (search) => routeSearchSchema.parse(search),
});

function RouteComponent() {
  const { itemId } = Route.useParams();
  const { did } = Route.useSearch();
  const { t } = useTranslation();
  const drag = useContentDrag();
  const view = useContentView();
  const queryData = useQueryData();
  const { onDragEnter, onDragLeave, onDragOver, onDrop } = useHandler();

  const [debouncedQ, setDebouncedQ] = useState("");
  const [extraItems, setExtraItems] = useState<Content[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const query = useQuery({
    queryKey: ["akasha", "drive", "item", itemId],
    queryFn: async () => {
      const { data, error } = await eden.akasha.content({ id: itemId }).get({
        query: { did },
      });

      if (error) {
        throw new Error(error.value.toString());
      }

      return data!;
    },
    placeholderData: (prev) => prev,
    refetchIntervalInBackground: true,
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.hidden) {
        return 60000 * 3; // 3분 (백그라운드)
      }
      return 30000; // 30초 (포그라운드)
    },
  });

  useEffect(() => {
    queryData.setData(query.data);
  }, [query.data]);

  useEffect(() => {
    if (view.searchInDirQuery) {
      view.setSearchInDirQuery("");
    }
    setDebouncedQ("");
  }, [itemId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQ(view.searchInDirQuery.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [view.searchInDirQuery]);

  const isSubdirSearchMode = view.includeSubdirs && itemId !== "share";
  const trimmedQuery = view.searchInDirQuery.trim();
  const isSearching = isSubdirSearchMode && trimmedQuery.length >= 2;
  const isDescendantSearch = isSearching && debouncedQ.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["akasha", "drive", "search", itemId, debouncedQ],
    enabled: isDescendantSearch,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await eden.akasha.content({ id: itemId }).search.get({
        query: { q: debouncedQ, limit: 50 },
      });

      if (error) {
        if (error.status === 503) {
          toast.error(t("drive.ui.search_unavailable"));
          throw new Error("search_unavailable");
        }

        throw new Error(error.value.toString());
      }

      return data!;
    },
  });

  useEffect(() => {
    setExtraItems([]);
    setNextCursor(null);
  }, [itemId, debouncedQ]);

  useEffect(() => {
    if (searchQuery.data) {
      setNextCursor(searchQuery.data.nextCursor);
    }
  }, [searchQuery.data]);

  const rawContents = useMemo(() => {
    if (!query.data?.children) return [];
    // oxlint-disable-next-line no-unsafe-optional-chaining
    return commonSort([...query.data?.children], view.sortType);
  }, [query.data?.children, view.sortType]);

  const localContents = useMemo(() => {
    if (!rawContents) return [];
    if (isSubdirSearchMode || !view.searchInDirQuery) return rawContents;

    const searchQueryText = view.searchInDirQuery.toLowerCase();
    const isChosungSearch = /^[ㄱ-ㅎ]+$/.test(searchQueryText);

    return rawContents
      .map((item) => ({
        item,
        score: getSearchScore(item.name, searchQueryText),
      }))
      .filter(({ item, score }) => {
        if (score > 0) return true;

        if (isChosungSearch) {
          const itemChosung = getChosung(item.name.toLowerCase());
          return itemChosung.includes(searchQueryText);
        }

        return false;
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [rawContents, view.searchInDirQuery, isSubdirSearchMode]);

  const searchContents = useMemo(() => {
    if (!searchQuery.data) return extraItems;
    return [...searchQuery.data.items, ...extraItems];
  }, [searchQuery.data, extraItems]);

  const displayContents = isDescendantSearch ? searchContents : isSearching ? [] : localContents;
  const isSearchPending =
    isSearching && (!isDescendantSearch || (searchQuery.isFetching && searchContents.length === 0));
  const isSearchFailed = isDescendantSearch && searchQuery.isError;
  const isSearchEmpty =
    isDescendantSearch &&
    searchQuery.isFetched &&
    !searchQuery.isError &&
    searchContents.length === 0;

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    const { data, error } = await eden.akasha
      .content({ id: itemId })
      .search.get({
        query: { q: debouncedQ, limit: 50, cursor: nextCursor },
      })
      .finally(() => setIsLoadingMore(false));

    if (error || !data) {
      toast.error(t("drive.ui.search_unavailable"));
      return;
    }

    setExtraItems((prev) => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
  }

  if (!query.data && query.isFetching) {
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
  }

  if (query.data)
    return (
      <>
        <div className="flex h-full w-full flex-col select-none">
          <div className="flex min-h-14 w-full flex-wrap items-center gap-y-1 border-b p-3 pl-11 md:h-14 md:flex-nowrap md:pl-3">
            <div className="min-w-0 flex-1">
              <AkashaBreadcrumb itemId={itemId} ancestors={query.data.ancestors} />
            </div>

            <AkashaHeadButtons of="drive" content={query.data.content!} itemId={itemId} />
          </div>

          <div
            className="flex flex-1 flex-col overflow-hidden"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop({ e, rawContents, itemId, of: "drive" })}
          >
            {displayContents.length > 0 && view.layout === "list" && <ListHead />}
            <ContextMenuProvider itemId={itemId} of="drive">
              <HandlerProvider sortedContents={displayContents}>
                {displayContents.length > 0 ? (
                  <div>
                    {view.layout === "list" ? (
                      <ContentMenuList
                        sortedContents={displayContents}
                        isFetching={query.isFetching}
                        itemId={itemId}
                      />
                    ) : view.layout === "grid" ? (
                      <ContentMenuGrid
                        sortedContents={displayContents}
                        isFetching={query.isFetching}
                        itemId={itemId}
                      />
                    ) : null}

                    {isDescendantSearch && nextCursor && (
                      <div className="flex justify-center p-4">
                        <Button
                          variant="outline"
                          disabled={isLoadingMore}
                          onClick={() => {
                            void loadMore();
                          }}
                        >
                          {t("drive.ui.search_load_more")}
                        </Button>
                      </div>
                    )}

                    {drag.uploadDragging && (
                      <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/10">
                        <div className="rounded-lg bg-background/90 p-4 shadow-lg">
                          <p className="text-lg font-medium">
                            {t("drive.ui.dir_drop_here_section_message.0")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isSearchFailed ? (
                  <Center className="flex-col">
                    <p className="text-center text-lg">{t("drive.ui.search_unavailable")}</p>
                  </Center>
                ) : isSearchEmpty ? (
                  <Center className="flex-col">
                    <div>
                      <FolderIcon width={80} height={80} />
                    </div>
                    <p className="mt-4 text-center text-lg">{t("drive.ui.search_no_results")}</p>
                  </Center>
                ) : isSearchPending || (query.isFetching && displayContents.length === 0) ? (
                  <AkashaSkeleton />
                ) : query.isFetched ? (
                  <Center className="flex-col">
                    <div>
                      <FolderIcon width={80} height={80} />
                    </div>
                    <p className="mt-4 text-center text-lg">
                      {t("drive.ui.no_contents_section_message.0")}
                    </p>
                    <p className="text-center text-muted-foreground">
                      {t("drive.ui.no_contents_section_message.1")}
                    </p>
                  </Center>
                ) : null}
              </HandlerProvider>
            </ContextMenuProvider>
          </div>
        </div>

        <RenameDialog />
        <NewDirectoryDialog contents={rawContents} />
        <PubLinkDialog />
      </>
    );
}
