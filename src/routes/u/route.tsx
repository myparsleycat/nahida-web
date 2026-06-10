import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useRequireSession } from "@/hooks/auth.hook";

export const Route = createFileRoute("/u")({
  component: RouteComponent,
});

function RouteComponent() {
  useRequireSession();

  return <Outlet />;
}
