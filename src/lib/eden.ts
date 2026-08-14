import type { App } from "@backend/index";
import { isMinified, unminify } from "@backend/utils/jsonMinify";
import { treaty } from "@elysiajs/eden";
import { isEmpty } from "es-toolkit/compat";
import ky from "ky";

import { globalStore } from "@/stores/global.store";

import { decodeCborBody, isCborContentType, jsonResponseFrom, readApiBody } from "./cbor-response";
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
    fetcher: (async (input: URL | RequestInfo, init: RequestInit | undefined) => {
        let response = await fetcher(input, init);
        const contentType = response.headers.get("Content-Type");

        if (isCborContentType(contentType)) {
            try {
                return rewriteEdenBody(
                    response,
                    decodeCborBody(new Uint8Array(await response.arrayBuffer())),
                );
            } catch (error) {
                console.error("CBOR decoding failed", error);

                const url = new URL(input instanceof Request ? input.url : String(input));
                url.searchParams.set("res", "json");
                response = await fetcher(url.toString(), init);
            }
        }

        if (!contentType?.includes("application/json") && !isCborContentType(contentType)) {
            return response;
        }

        try {
            return rewriteEdenBody(response, await readApiBody(response));
        } catch {
            return response;
        }
    }) as typeof fetch,
    parseDate: false,
});

function rewriteEdenBody(response: Response, data: unknown) {
    return jsonResponseFrom(response, isMinified(data) ? unminify(data) : data);
}

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
