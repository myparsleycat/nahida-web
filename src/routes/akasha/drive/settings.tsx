import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/akasha/drive/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/akasha/drive/settings"!</div>;
}
