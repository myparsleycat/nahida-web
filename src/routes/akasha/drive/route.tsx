import { createFileRoute, Outlet } from "@tanstack/react-router";

import { EmptyTrashDialog } from "@/components/page/akasha/dialogs";
import { DriveInnerNav } from "@/components/page/akasha/DriveInnerNav";
import { useIsMobileWidth } from "@/hooks/use-mobile";

export const Route = createFileRoute("/akasha/drive")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "드라이브 | 나히다 라이브" }],
  }),
});

function RouteComponent() {
  const isMobile = useIsMobileWidth();

  return (
    <>
      <div className="h-full">
        <div className="flex h-full w-full data-[panel-group-direction=vertical]:flex-col">
          {isMobile ? null : (
            <div className="flex flex-col border-r">
              <DriveInnerNav />
            </div>
          )}

          <div className="relative flex-1 overflow-hidden">
            <div className="relative flex h-full grow">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      <EmptyTrashDialog />
    </>
  );
}
