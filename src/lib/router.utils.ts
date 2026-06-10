import { redirect } from "@tanstack/react-router";

import { authClient } from "./auth-client";

export async function beforeSessProtect() {
    const session = await authClient.getSession();
    if (!session.data) {
        throw redirect({
            to: "/",
            search: {
                redirect: window.location.href,
            },
        });
    }
}
