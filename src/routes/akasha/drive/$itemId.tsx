import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Folder as FolderIcon } from "pixelarticons/react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { AliceLoader, Center, ServerCrash } from "@/components/common";
import {
  AkashaBreadcrumb,
  AkashaHeadButtons,
  AkashaSkeleton,
  ContentMenuGrid,
  ContentMenuList,
  ContextMenuProvider,
  HandlerProvider,
} from "@/components/page/akasha";
import { NewDirectoryDialog, PubLinkDialog, RenameDialog } from "@/components/page/akasha/dialogs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  }, [itemId]);

  const rawContents = useMemo(() => {
    if (!query.data?.children) return [];
    // oxlint-disable-next-line no-unsafe-optional-chaining
    return commonSort([...query.data?.children], view.sortType);
  }, [query.data?.children, view.sortType]);

  const sortedContents = useMemo(() => {
    if (!rawContents) return [];
    if (!view.searchInDirQuery) return rawContents;

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
  }, [rawContents, view.searchInDirQuery]);

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

            <AkashaHeadButtons of="drive" content={query.data.content!} />
          </div>

          <div
            className="flex flex-1 flex-col overflow-auto"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop({ e, rawContents, itemId, of: "drive" })}
          >
            <ContextMenuProvider itemId={itemId} of="drive">
              <HandlerProvider sortedContents={sortedContents}>
                {sortedContents.length > 0 ? (
                  <ScrollArea className="flex h-full flex-1 flex-col">
                    <>
                      {view.layout === "list" ? (
                        <ContentMenuList
                          sortedContents={sortedContents}
                          isFetching={query.isFetching}
                          itemId={itemId}
                        />
                      ) : view.layout === "grid" ? (
                        <ContentMenuGrid
                          sortedContents={sortedContents}
                          isFetching={query.isFetching}
                          itemId={itemId}
                        />
                      ) : null}

                      {drag.uploadDragging && (
                        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/10">
                          <div className="rounded-lg bg-background/90 p-4 shadow-lg">
                            <p className="text-lg font-medium">
                              {t("drive.ui.dir_drop_here_section_message.0")}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  </ScrollArea>
                ) : query.isFetched && sortedContents.length < 1 ? (
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
                ) : query.isFetching && sortedContents.length === 0 ? (
                  <AkashaSkeleton />
                ) : null}
              </HandlerProvider>
            </ContextMenuProvider>
          </div>
        </div>

        <RenameDialog />
        <NewDirectoryDialog contents={sortedContents} />
        <PubLinkDialog />
      </>
    );
}
