import { useNavigate } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, FolderIcon } from "lucide-react";
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
    <div className="flex">
      {ancestors.length > 1 && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (!current?.parentId) return;
            onNavigate(current.parentId);
          }}
        >
          <ChevronLeftIcon size={20} />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }))}>
          <FolderIcon className="mr-2 h-4 w-4" />
          {current?.name}
          <ChevronDownIcon />
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
