import { createFileRoute, Outlet } from "@tanstack/react-router";

import { NotiDialog } from "@/components/page/akasha/dialogs";

export const Route = createFileRoute("/akasha")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Outlet />
      <NotiDialog />
    </>
  );
}
