import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import ky from "ky";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AliceLoader, Center } from "@/components/common";
import { BACKEND_ORIGIN } from "@/lib/const";

const Schema = z.object({
  state: z.string(),
});

export const Route = createFileRoute("/desktop/auth")({
  component: RouteComponent,
  validateSearch: zodValidator(Schema),
});

function RouteComponent() {
  const { state } = Route.useSearch();
  const navi = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const f = async () => {
      const url = `${BACKEND_ORIGIN}/api/auth/desktop/auth/im-loggedin`;
      const data = await ky
        .post(url, {
          json: { state },
          credentials: "include",
        })
        .json<{ success: boolean; message: string }>();

      if (data.success) {
        navi({ to: "/desktop/logged-in" });
      } else {
        setError(data.message);
      }
    };

    f();
    setLoading(false);
  }, [state]);

  return (
    <Center>
      {loading ? <AliceLoader /> : null}
      {error ? <div className="text-lg">{error}</div> : null}
    </Center>
  );
}
