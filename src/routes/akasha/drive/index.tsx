import { createFileRoute, redirect } from "@tanstack/react-router";

import { eden } from "@/lib/eden";

export const Route = createFileRoute("/akasha/drive/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const { data, error } = await eden.akasha.drive.my.get();

    if (!data || error) {
      throw redirect({ to: "/sign-in" });
    }

    throw redirect({ to: "/akasha/drive/$itemId", params: { itemId: data.rootId } });
  },
});

function RouteComponent() {
  return null;
}
