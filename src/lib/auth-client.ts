import { usernameClient, adminClient, customSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { BACKEND_ORIGIN } from "./const";

export const authClient = createAuthClient({
    baseURL: BACKEND_ORIGIN,
    plugins: [usernameClient(), adminClient(), customSessionClient()],
});

type InferredSession = typeof authClient.$Infer.Session;

export interface SessionDrive {
    id: string;
    rootId: string;
}

export type SessionData = InferredSession & {
    drive?: SessionDrive | null;
};

export type Session = SessionData;

export async function getSession() {
    const session = await authClient.getSession();

    return {
        ...session,
        data: (session.data ?? null) as Session | null,
    };
}

export function useSession() {
    const d = authClient.useSession();

    return {
        ...d,
        data: (d.data ?? null) as Session | null,
    };
}

export const { signOut, signIn, signUp } = authClient;
