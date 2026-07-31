import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { SignUpCard } from "@/components/auth";
import { Center } from "@/components/common";
import { useSession } from "@/lib/auth-client";

const SigUpSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-up")({
  component: RouteComponent,
  validateSearch: (search) => SigUpSearchSchema.parse(search),
});

function RouteComponent() {
  const navi = useNavigate();
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      void navi({ to: "/u" }).catch((error) => {
        console.error("Failed to redirect after sign-up:", error);
      });
    }
  }, [session]);

  return (
    <div className="relative h-full w-full">
      <Center size="page-full" className="p-3">
        <SignUpCard className="z-10" />
      </Center>
    </div>
  );
}
