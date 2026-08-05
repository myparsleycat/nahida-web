import { useNavigate, useParams } from "@tanstack/react-router";
import { Folder as FolderIcon, InfoBox as InfoIcon } from "pixelarticons/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Content } from "@/lib/akasha";

import {
  AkashaHeadButtons,
  AkashaModDDBreadcrumb,
  AkashaSkeleton,
  ContentMenuGrid,
  ContentMenuList,
  ContextMenuProvider,
  type Ancestor,
} from "@/components/page/akasha";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModContext } from "@/context/ModContext";
import { useContentDrag, useContentView, useHandler } from "@/hooks/akasha";
import { useIsMobileWidth } from "@/hooks/use-mobile";
import { parseModPath } from "@/lib/akasha/services/mod-drive/common";
import { getChosung, getSearchScore } from "@/lib/sejong";
import { commonSort } from "@/lib/utils";
import { naturalCompare } from "@/lib/utils/str-filter";

import { Center } from "../common";

interface AkashaModBaseProps {
  content: Content;
  children: Content[];
  ancestors: Ancestor[];
  isFetching: boolean;
  isFetched: boolean;
  itemId: string;
}

export function AkashaModContents(props: AkashaModBaseProps) {
  const { content, children, ancestors, isFetched, isFetching, itemId } = props;

  const { t } = useTranslation();
  const view = useContentView();

  const drag = useContentDrag();
  const { onDragEnter, onDragLeave, onDragOver, onDrop } = useHandler();
  const { modQuery, sig, accessToken, collectionId, setItemId, setOpenInfo } = useModContext();
  const isMobile = useIsMobileWidth();

  const rawContents = useMemo(() => {
    return commonSort(children, view.sortType);
  }, [children, view.sortType]);

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

  return (
    <div className="flex h-full flex-col select-none">
      <div className="flex min-h-14 w-full flex-wrap items-center gap-y-1 border-b p-3 pl-11 md:h-14 md:flex-nowrap md:pl-3">
        <div className="min-w-0 flex-1">
          {/* <AkashaModBreadcrumb
            itemId={content.id}
            ancestors={ancestors}
          /> */}
          <AkashaModDDBreadcrumb itemId={content.id} ancestors={ancestors} />
        </div>

        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 shrink-0 md:hidden"
            onClick={() => setOpenInfo(true)}
            aria-label="Open mod info"
          >
            <InfoIcon />
          </Button>
        )}

        <AkashaHeadButtons
          of="mod"
          content={content}
          modQuery={modQuery}
          modAccessToken={accessToken}
          modSig={sig}
        />
      </div>

      <div
        className="flex flex-1 flex-col overflow-auto"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={(e) =>
          onDrop({
            e,
            of: "mod",
            rawContents,
            itemId: content.id,
            collectionId,
            sig,
          })
        }
      >
        <ContextMenuProvider itemId={content.id} of="mod" navi={setItemId}>
          {sortedContents.length > 0 ? (
            <div>
              {view.layout === "list" ? (
                <ContentMenuList
                  sortedContents={sortedContents}
                  isFetching={isFetching}
                  itemId={itemId}
                />
              ) : view.layout === "grid" ? (
                <ContentMenuGrid
                  sortedContents={sortedContents}
                  isFetching={isFetching}
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
            </div>
          ) : isFetched && sortedContents.length < 1 ? (
            <Center>
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
            </Center>
          ) : isFetching && sortedContents.length === 0 ? (
            <AkashaSkeleton />
          ) : null}
        </ContextMenuProvider>
      </div>
    </div>
  );
}
