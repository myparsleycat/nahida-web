import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mods/$modId/logs")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/mods/$modId/logs"!</div>;
}
