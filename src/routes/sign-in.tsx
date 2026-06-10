import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { SignInCard } from "@/components/auth";
import { Center } from "@/components/common";
import { useSession } from "@/lib/auth-client";

const SignInSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
  component: RouteComponent,
  validateSearch: (search) => SignInSearchSchema.parse(search),
});

function RouteComponent() {
  const navi = useNavigate();
  const { data: session } = useSession();

  useEffect(() => {
    if (session) navi({ to: "/u" });
  }, [session]);

  return (
    <div className="relative h-full w-full">
      {/* <div className='absolute top-0 left-0 h-full w-full'>
        <Threads
          amplitude={3}
          distance={0}
          enableMouseInteraction={false}
        />
      </div> */}

      <Center size="page-full" className="p-3">
        <SignInCard className="z-10" />
      </Center>
    </div>
  );
}
