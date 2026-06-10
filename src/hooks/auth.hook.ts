import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

export const useRequireSession = () => {
    const navi = useNavigate();
    const { data, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !data) {
            navi({
                to: "/sign-in",
                search: {
                    redirect: window.location.href,
                },
            });
        }
    }, [isPending, data]);

    return {
        data,
    };
};

export const useOnlyAdmin = () => {
    const navi = useNavigate();
    const { data, isPending } = useSession();

    useEffect(() => {
        if ((!isPending && !data) || (data && data.user.role !== "staff")) {
            navi({
                to: "/",
                search: {
                    redirect: window.location.href,
                },
            });
        }
    }, [data, isPending]);
};
