import { Skeleton } from "@/components/ui/skeleton";
import { useContentView } from "@/hooks/akasha";
import { cn, getRandInt } from "@/lib/utils";

export function AkashaSkeleton() {
  const view = useContentView();

  if (view.layout === "list") {
    return Array.from({ length: getRandInt(3, 12) }, (_, idx) => (
      <div key={idx} className={cn("flex flex-row items-center gap-4 px-3 py-2")}>
        <div className="flex flex-row items-center gap-2">
          <div className="flex size-12 p-0.5 text-muted-foreground">
            <div className="flex h-full w-full items-center justify-center">
              <Skeleton className="size-full rounded-lg" />
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-row items-center gap-2">
          <div className="min-w-0 grow">
            <Skeleton className="h-5" style={{ width: getRandInt(80, 250) }} />
          </div>
        </div>

        <div className="flex flex-row items-center gap-2">
          <div className="min-w-0 text-sm text-muted-foreground">
            <Skeleton className="h-5" style={{ width: getRandInt(45, 65) }} />
          </div>
        </div>

        <div className="text-right text-sm text-nowrap text-muted-foreground">
          <Skeleton className="h-5" style={{ width: getRandInt(145, 155) }} />
        </div>
      </div>
    ));
  }

  return <></>;
}
