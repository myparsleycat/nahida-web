import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

export function ProtectedLayout() {
  const navi = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      void navi({ to: "/" }).catch((error) => {
        console.error("Failed to redirect from protected layout:", error);
      });
    }
  }, [session.data]);

  if (!session.data) {
    return null;
  }

  return <Outlet />;
}
