import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useOnlyAdmin } from "@/hooks/auth.hook";

export const Route = createFileRoute("/admin")({
  component: RouteComponent,
});

function RouteComponent() {
  useOnlyAdmin();

  return <Outlet />;
}
