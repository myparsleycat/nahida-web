import { FolderIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Content } from "@/lib/akasha";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useContentView } from "@/hooks/akasha";
import { useSession } from "@/lib/auth-client";
import { getChosung, getSearchScore } from "@/lib/sejong";
import { commonSort } from "@/lib/utils";
import { naturalCompare } from "@/lib/utils/str-filter";

import {
  AkashaBreadcrumbWithNavi,
  AkashaHeadButtons,
  AkashaSkeleton,
  ContentMenuGrid,
  ContentMenuList,
  ContextMenuProvider,
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
    <div className="flex h-full w-full flex-col select-none">
      <div className="flex h-14 w-full items-center border-b p-3">
        <div className="min-w-0 flex-1">
          <AkashaBreadcrumbWithNavi navi={navi} itemId={currentId} ancestors={ancestors} />
        </div>

        <AkashaHeadButtons of="link" content={content} link={link} />
      </div>

      <div className="flex flex-1 flex-col overflow-auto">
        <ContextMenuProvider itemId={currentId} of="link" link={link} navi={navi}>
          <ScrollArea className="flex h-full flex-1 flex-col">
            {sortedContents.length > 0 ? (
              view.layout === "list" ? (
                <ContentMenuList
                  itemId={currentId}
                  sortedContents={sortedContents}
                  isFetching={isFetching}
                />
              ) : view.layout === "grid" ? (
                <ContentMenuGrid
                  itemId={currentId}
                  sortedContents={sortedContents}
                  isFetching={isFetching}
                />
              ) : null
            ) : isFetched && sortedContents.length < 1 ? (
              <div className="flex h-full w-full flex-row items-center justify-center select-none">
                <div className="flex flex-col items-center justify-center p-4">
                  <div>
                    <FolderIcon size="100" />
                  </div>
                  <p className="mt-4 text-center text-xl">
                    {t("drive.ui.no_contents_section_message.0")}
                  </p>
                  <p className="text-center text-muted-foreground">
                    {t("drive.ui.no_contents_section_message.1")}
                  </p>
                </div>
              </div>
            ) : isFetching && sortedContents.length === 0 ? (
              <AkashaSkeleton />
            ) : null}
          </ScrollArea>
        </ContextMenuProvider>
      </div>
    </div>
  );
}
