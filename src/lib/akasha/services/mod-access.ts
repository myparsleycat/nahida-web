export interface CachedModAccess {
    password?: string;
    token?: string;
}

export function getCachedModAccess(modId: string): CachedModAccess {
    try {
        const value: unknown = JSON.parse(sessionStorage.getItem(`akasha-mod:${modId}`) ?? "{}");
        if (!value || typeof value !== "object") return {};

        const cached = value as Record<string, unknown>;
        return {
            password:
                typeof cached.password === "string"
                    ? cached.password
                    : typeof cached.pwd === "string"
                      ? cached.pwd
                      : undefined,
            token: typeof cached.token === "string" ? cached.token : undefined,
        };
    } catch {
        return {};
    }
}

export function setCachedModAccess(modId: string, access: CachedModAccess) {
    sessionStorage.setItem(`akasha-mod:${modId}`, JSON.stringify(access));
}
