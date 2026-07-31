import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

export const useRequireSession = () => {
    const navi = useNavigate();
    const { data, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !data) {
            void navi({
                to: "/sign-in",
                search: {
                    redirect: window.location.href,
                },
            }).catch((error) => {
                console.error("Failed to redirect to sign-in:", error);
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
            void navi({
                to: "/",
                search: {
                    redirect: window.location.href,
                },
            }).catch((error) => {
                console.error("Failed to redirect from admin page:", error);
            });
        }
    }, [data, isPending]);
};
