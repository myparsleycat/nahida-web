import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

export function ProtectedLayout() {
  const navi = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      navi({ to: "/" });
    }
  }, [session.data]);

  if (!session.data) {
    return null;
  }

  return <Outlet />;
}
