import { useNavigate } from "@tanstack/react-router";
import {
  Check as CheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  Folder as FolderIcon,
} from "pixelarticons/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModContext } from "@/context/ModContext";
import { cn } from "@/lib/utils";

import type { Ancestor } from "./types";

interface AkashaBreadcrumbProps {
  itemId: string;
  ancestors: Ancestor[];
  navi?: (id: string) => void;
}

function BreadcrumbInner({
  ancestors,
  onNavigate,
}: {
  ancestors: Ancestor[];
  onNavigate: (id: string) => void;
}) {
  const current = useMemo(() => {
    if (ancestors.length === 0) return undefined;
    return ancestors[ancestors.length - 1];
  }, [ancestors]);

  return (
    <div className="flex min-w-0">
      {ancestors.length > 1 && (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            if (!current?.parentId) return;
            onNavigate(current.parentId);
          }}
        >
          <ChevronLeftIcon width={20} height={20} />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "min-w-0")}>
          <FolderIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{current?.name}</span>
          <ChevronDownIcon className="shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[...ancestors].reverse().map((ancestor) => (
            <DropdownMenuItem key={ancestor.id} onClick={() => onNavigate(ancestor.id!)}>
              {ancestor.name}
              {ancestor.id === current?.id && <CheckIcon />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AkashaBreadcrumb(props: AkashaBreadcrumbProps) {
  const { ancestors, navi } = props;
  const { t } = useTranslation();
  const router = useNavigate();

  const navigate =
    navi ?? ((id: string) => router({ to: "/akasha/drive/$itemId", params: { itemId: id } }));

  return <BreadcrumbInner ancestors={ancestors} onNavigate={navigate} />;
}

export function AkashaModDDBreadcrumb(props: AkashaBreadcrumbProps) {
  const { ancestors } = props;
  const { setItemId } = useModContext();

  return <BreadcrumbInner ancestors={ancestors} onNavigate={setItemId} />;
}

export function AkashaBreadcrumbWithNavi(
  props: AkashaBreadcrumbProps & {
    navi: (id: string) => void;
  },
) {
  const { ancestors, navi } = props;

  return <BreadcrumbInner ancestors={ancestors} onNavigate={navi} />;
}
