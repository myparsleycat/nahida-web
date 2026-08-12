import { useQuery } from "@tanstack/react-query";
import { Folder as FolderIcon } from "pixelarticons/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Content } from "@/lib/akasha";

import { Button } from "@/components/ui/button";
import { useContentView } from "@/hooks/akasha";
import { eden } from "@/lib/eden";
import { getChosung, getSearchScore } from "@/lib/sejong";
import { commonSort } from "@/lib/utils";

import {
  AkashaBreadcrumbWithNavi,
  AkashaHeadButtons,
  AkashaSkeleton,
  ContentMenuGrid,
  ContentMenuList,
  ContextMenuProvider,
  ListHead,
  type Ancestor,
} from "./index";

interface ShareLinkContentsProps {
  link: { linkId: string; token: string };
  content: Content;
  children: Content[];
  ancestors: Ancestor[];
  isFetching: boolean;
  isFetched: boolean;
  navi: (id: string) => void;
  currentId: string;
}

export function ShareLinkContents(props: ShareLinkContentsProps) {
  const { link, content, children, ancestors, isFetched, isFetching, navi, currentId } = props;
  const { t } = useTranslation();
  const view = useContentView();

  const [debouncedQ, setDebouncedQ] = useState("");
  const [extraItems, setExtraItems] = useState<Content[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (view.searchInDirQuery) {
      view.setSearchInDirQuery("");
    }
    setDebouncedQ("");
  }, [currentId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQ(view.searchInDirQuery.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [view.searchInDirQuery]);

  const isSubdirSearchMode = view.includeSubdirs;
  const trimmedQuery = view.searchInDirQuery.trim();
  const isSearching = isSubdirSearchMode && trimmedQuery.length >= 2;
  const isDescendantSearch = isSearching && debouncedQ.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["akasha", "link", "search", link.linkId, currentId, debouncedQ],
    enabled: isDescendantSearch,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await eden.akasha
        .link({ linkId: link.linkId })
        .content({ id: currentId })
        .search.get({
          query: { q: debouncedQ, limit: 50 },
          headers: { "nhd-link-token": link.token },
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
    setIsLoadingMore(false);
  }, [link.linkId, currentId, debouncedQ]);

  useEffect(() => {
    if (searchQuery.data) {
      setNextCursor(searchQuery.data.nextCursor);
    }
  }, [searchQuery.data]);

  const rawContents = useMemo(() => {
    return commonSort(children, view.sortType);
  }, [children, view.sortType]);

  const sortedContents = useMemo(() => {
    if (!rawContents) return [];
    if (isSubdirSearchMode || !view.searchInDirQuery) return rawContents;

    const query = view.searchInDirQuery.toLowerCase();
    const isChosungSearch = /^[ㄱ-ㅎ]+$/.test(query);

    return rawContents
      .map((item) => ({
        item,
        score: getSearchScore(item.name, query),
      }))
      .filter(({ item, score }) => {
        if (score > 0) return true;

        if (isChosungSearch) {
          const itemChosung = getChosung(item.name.toLowerCase());
          return itemChosung.includes(query);
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

  const displayContents = isDescendantSearch ? searchContents : isSearching ? [] : sortedContents;
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

    const identity = `${link.linkId}:${currentId}:${debouncedQ}`;
    setIsLoadingMore(true);
    const { data, error } = await eden.akasha
      .link({ linkId: link.linkId })
      .content({ id: currentId })
      .search.get({
        query: { q: debouncedQ, limit: 50, cursor: nextCursor },
        headers: { "nhd-link-token": link.token },
      })
      .finally(() => setIsLoadingMore(false));

    if (identity !== `${link.linkId}:${currentId}:${debouncedQ}`) return;

    if (error || !data) {
      toast.error(t("drive.ui.search_unavailable"));
      return;
    }

    setExtraItems((prev) => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
  }

  return (
    <div className="flex h-full w-full flex-col select-none">
      <div className="flex min-h-14 w-full flex-wrap items-center gap-y-1 border-b p-3 pl-11 md:h-14 md:flex-nowrap md:pl-3">
        <div className="min-w-0 flex-1">
          <AkashaBreadcrumbWithNavi navi={navi} itemId={currentId} ancestors={ancestors} />
        </div>

        <AkashaHeadButtons of="link" content={content} link={link} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {displayContents.length > 0 && view.layout === "list" && <ListHead />}
        <ContextMenuProvider itemId={currentId} of="link" link={link} navi={navi}>
          {displayContents.length > 0 ? (
            <div>
              {view.layout === "list" ? (
                <ContentMenuList
                  itemId={currentId}
                  sortedContents={displayContents}
                  isFetching={isFetching}
                />
              ) : view.layout === "grid" ? (
                <ContentMenuGrid
                  itemId={currentId}
                  sortedContents={displayContents}
                  isFetching={isFetching}
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
            </div>
          ) : isSearchFailed ? (
            <div className="flex h-full w-full flex-row items-center justify-center select-none">
              <p className="text-center text-lg">{t("drive.ui.search_unavailable")}</p>
            </div>
          ) : isSearchEmpty ? (
            <div className="flex h-full w-full flex-row items-center justify-center select-none">
              <div className="flex flex-col items-center justify-center p-4">
                <div>
                  <FolderIcon width={100} height={100} />
                </div>
                <p className="mt-4 text-center text-xl">{t("drive.ui.search_no_results")}</p>
              </div>
            </div>
          ) : isSearchPending ? (
            <AkashaSkeleton />
          ) : isFetched ? (
            <div className="flex h-full w-full flex-row items-center justify-center select-none">
              <div className="flex flex-col items-center justify-center p-4">
                <div>
                  <FolderIcon width={100} height={100} />
                </div>
                <p className="mt-4 text-center text-xl">
                  {t("drive.ui.no_contents_section_message.0")}
                </p>
                <p className="text-center text-muted-foreground">
                  {t("drive.ui.no_contents_section_message.1")}
                </p>
              </div>
            </div>
          ) : isFetching && displayContents.length === 0 ? (
            <AkashaSkeleton />
          ) : null}
        </ContextMenuProvider>
      </div>
    </div>
  );
}
