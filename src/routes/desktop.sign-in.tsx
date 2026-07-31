import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { AlertWithRandom1619, Center } from "@/components/common";
import { getSession, type Session } from "@/lib/auth-client";

export const Route = createFileRoute("/desktop/sign-in")({
  component: RouteComponent,
  loader: async () => {
    const session = await getSession();
    return { session: session.data };
  },
});

function NotLogIn() {
  return (
    <Center size="page-full">
      <AlertWithRandom1619 message="로그인 후 다시 시도해주세요" />
    </Center>
  );
}

function desktopSignInProcess({ session }: { session: Session | null }) {
  if (!session) return;
}

function RouteComponent() {
  const data = Route.useLoaderData();

  useEffect(() => {
    desktopSignInProcess({ session: data.session });
  }, []);

  if (!data.session) {
    return <NotLogIn />;
  }

  return <div></div>;
}
