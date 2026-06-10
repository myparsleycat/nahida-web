import { createFileRoute } from "@tanstack/react-router";

import { Center } from "@/components/common";

export const Route = createFileRoute("/desktop/logged-in")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Center className="flex flex-col space-y-6 text-center">
      <h2 className="text-2xl font-bold">Authentication Successful</h2>
      <p className="text-lg">
        You have successfully signed into Nahida Desktop and can close this at any time.
      </p>
    </Center>
  );
}
