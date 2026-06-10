import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Center, Random1619 } from "@/components/common";
import { NotiDialog } from "@/components/page/akasha/dialogs";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/akasha")({
  component: RouteComponent,
});

function RouteComponent() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Center className="p-4">
        <div className="flex flex-col items-center space-y-4">
          <Random1619 />
          <div className="flex flex-col text-center">
            <span className="text-lg">Please use a PC</span>
            <span className="text-pretty text-muted-foreground">
              Akasha services do not support mobile devices
            </span>
          </div>
        </div>
      </Center>
    );
  }

  return (
    <>
      <Outlet />
      <NotiDialog />
    </>
  );
}
