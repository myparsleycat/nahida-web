import type { App } from "@backend/index";
import { isMinified, unminify } from "@backend/utils/jsonMinify";
import { treaty } from "@elysiajs/eden";
import { decode } from "cbor-x";
import { isEmpty } from "es-toolkit/compat";
import ky from "ky";

import { globalStore } from "@/stores/global.store";

import { BACKEND_ORIGIN } from "./const";

const fetcher = (url: string | Request | URL, init?: RequestInit) => {
    const fpHash = globalStore.getState().fpHash;

    const headers = new Headers(init?.headers);

    if (fpHash) {
        headers.set("x-fpid", fpHash);
    }

    return ky(url, {
        ...init,
        credentials: "include",
        headers,
        throwHttpErrors: false,
        timeout: 60000,
        retry: {
            limit: 0,
        },
    });
};

// @ts-expect-error
export const eden = treaty<App>(BACKEND_ORIGIN, {
    headers: { "x-akasha-storage-version": "2" },
    fetcher: (async (input: URL | RequestInfo, init: RequestInit | undefined) => {
        const reqInit = init || {};

        let response = await fetcher(input, reqInit);
        let contentType = response.headers.get("Content-Type");

        let data: any = null;
        let shouldProcess = false;

        if (contentType?.includes("application/cbor")) {
            try {
                const arrbuf = await response.arrayBuffer();
                data = decode(new Uint8Array(arrbuf));
                shouldProcess = true;
            } catch (err: any) {
                console.error("CBOR decoding failed", err);

                const url = new URL(input instanceof Request ? input.url : String(input));

                url.searchParams.set("res", "json");

                response = await fetcher(url.toString(), init);
                contentType = response.headers.get("Content-Type");

                if (contentType?.includes("application/json")) {
                    try {
                        data = await response.json();
                        shouldProcess = true;
                    } catch {
                        return response;
                    }
                } else {
                    return response;
                }
            }
        } else if (contentType?.includes("application/json")) {
            try {
                data = await response.json();
                shouldProcess = true;
            } catch {
                return response;
            }
        }

        if (shouldProcess) {
            if (isMinified(data)) {
                data = unminify(data);
            }

            const newHeaders = new Headers(response.headers);
            newHeaders.set("Content-Type", "application/json");

            return new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }

        return response;
    }) as typeof fetch,
    parseDate: false,
});

type EdenProxy = {
    [K in string]: EdenProxy;
} & ((args?: Record<string, any>) => EdenProxy) & {
        url: (options?: { query?: Record<string, any> }) => string;
    };

function createProxy(pathSegments: string[] = []): EdenProxy {
    const handler: ProxyHandler<any> = {
        get(_target, prop: string) {
            if (prop === "url") {
                return ({ query }: { query?: Record<string, any> } = {}) => {
                    const path = pathSegments.join("/");
                    const url = new URL(`${BACKEND_ORIGIN}/${path}`);

                    if (query && !isEmpty(query)) {
                        Object.entries(query).forEach(([key, value]) => {
                            if (value !== undefined && value !== null) {
                                url.searchParams.append(key, String(value));
                            }
                        });
                    }

                    return url.toString();
                };
            }
            return createProxy([...pathSegments, prop]);
        },
        apply(_target, _thisArg, args) {
            const firstArg = args[0];
            if (firstArg && typeof firstArg === "object") {
                const pathValues = Object.values(firstArg).map(String);
                return createProxy([...pathSegments, ...pathValues]);
            }
            return createProxy(pathSegments);
        },
    };

    const target = () => {};
    return new Proxy(target, handler) as unknown as EdenProxy;
}

export const eden2url = createProxy();
