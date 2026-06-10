// import { Turnstile } from '@marsidev/react-turnstile';
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Content } from "@/lib/akasha";

import { AlertWithRandom1619, AliceLoader, Center } from "@/components/common";
import { ShareLinkContents } from "@/components/page/akasha/ShareLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eden } from "@/lib/eden";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/akasha/link/$linkId")({
  component: RouteComponent,
});

function RouteComponent() {
  const linkId = Route.useParams().linkId;
  const { t } = useTranslation();

  const [errMsg, setErrMsg] = useState("");
  const [token, setToken] = useState("");
  const [firstLoading, setFirstLoading] = useState(true);
  const [reqPwd, setReqPwd] = useState(false);
  const [inPwd, setInPwd] = useState("");
  const [msg, setMsg] = useState(t("drive.link.required_password"));
  // const [needToken, setNeedToken] = useState(false);
  // const turnstileRef = useRef(null);
  const [currentId, setCurrentId] = useState("");
  const [linkParent, setLinkParent] = useState<{ id: string; name: string } | null>(null);
  // const tokenResolverRef = useRef<(token: string) => void | null>(null);

  const link = useMemo(() => {
    return { linkId, token };
  }, [linkId, token]);

  useEffect(() => {
    initializeExplorer();
  }, []);

  const query = useQuery({
    queryKey: ["akasha", "link", currentId],
    queryFn: async () => {
      if (!currentId) return null;
      const { data, error } = await eden.akasha
        .link({ linkId })
        .content({ id: currentId })
        .get({
          headers: {
            ...(token ? { "nhd-link-token": token } : {}),
          },
        });

      if (error) {
        throw new Error(error.value.toString());
      }

      return data;
    },
    enabled: !!currentId,
    placeholderData: (prev) => prev,
    refetchIntervalInBackground: true,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) {
        return 60000 * 3; // 3분 (백그라운드)
      }
      return 30000; // 30초 (포그라운드)
    },
  });

  function cfReset() {
    // @ts-ignore
    turnstileRef.current?.reset?.();
  }

  // function getTurnstileToken(): Promise<string> {
  //   return new Promise((resolve) => {
  //     tokenResolverRef.current = resolve;
  //     setNeedToken(true);
  //   });
  // }

  async function initializeExplorer() {
    const cachedData = sessionStorage.getItem(`linkData-${linkId}`);
    if (cachedData) {
      const { cachedToken, cachedParent, expirationTime } = JSON.parse(cachedData);
      if (Date.now() > expirationTime) {
        sessionStorage.removeItem(`linkData-${linkId}`);
      } else {
        setToken(cachedToken);
        setLinkParent(cachedParent);
        setCurrentId(cachedParent.id);
        setFirstLoading(false);
        return;
      }
    }

    // const cftoken = await getTurnstileToken();

    try {
      const { data, error } = await eden.akasha.link({ linkId }).post({
        password: inPwd,
        cftoken: "", // cftoken,
      });

      if (error) {
        if (error.status === 429) {
          const msg = t("toast.warning.retryAfter", {
            sec: error.value.retryAfter,
          });
          toast.warning(t("toast.warning.too_many_requests"), {
            description: msg,
          });
          setMsg(msg);
          setReqPwd(true);
          return;
        }

        switch (error.value) {
          case "missing_password":
            setReqPwd(true);
            break;
          case "invalid_password":
            toast.warning(t("toast.warning.invalid_password"));
            setMsg(t("toast.warning.invalid_password"));
            setReqPwd(true);
            break;
          case "Not Found":
            setErrMsg(t("drive.link.not_found"));
            break;
          default:
            const text = error.value.toString();
            toast.warning(text);
            setMsg(text);
        }
        return;
      }

      setReqPwd(false);
      const newToken = data.token;
      const newParent = data.parent;

      setToken(newToken);
      setLinkParent(newParent);
      setCurrentId(newParent.id);

      const expirationTime = Date.now() + 12 * 60 * 60 * 1000;

      sessionStorage.setItem(
        `linkData-${linkId}`,
        JSON.stringify({
          cachedToken: newToken,
          cachedParent: newParent,
          expirationTime,
        }),
      );
    } finally {
      // cfReset();
      setFirstLoading(false);
    }
  }

  async function handlePasswordSubmit() {
    if (!inPwd) {
      return toast.warning(t("toast.warning.pw_is_required"));
    }
    await initializeExplorer();
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {firstLoading && !reqPwd && (
          <Center>
            <AliceLoader />
          </Center>
        )}

        {errMsg && (
          <Center className="w-full">
            <AlertWithRandom1619 message={errMsg} />
          </Center>
        )}

        {reqPwd && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-100 flex-col gap-y-4">
              <p>{msg}</p>
              <div className="flex gap-x-4">
                <Input
                  className={cn(
                    "w-full rounded-lg border-none bg-black/5 px-3 py-1.5 text-sm/6 dark:bg-white/5",
                    "focus:outline-hidden data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25",
                  )}
                  autoFocus
                  required
                  value={inPwd}
                  onChange={(e) => setInPwd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePasswordSubmit();
                    }
                  }}
                />
                <Button onClick={handlePasswordSubmit}>{t("g.continue")}</Button>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          {query.data && !firstLoading && !reqPwd && (
            <ShareLinkContents
              link={link}
              content={query.data.content as Content}
              children={query.data.children}
              ancestors={query.data.ancestors}
              isFetched={query.isFetched}
              isFetching={query.isFetching}
              navi={setCurrentId}
              currentId={currentId}
            />
          )}
        </div>

        {/* <div className="border-t flex justify-center items-center h-[90px]">
          <ins
            className="adsbygoogle"
            style={{ display: 'inline-block', width: 728, height: 88 }}
            data-ad-client="ca-pub-2531929543941857"
            data-ad-slot="4810314528"
          ></ins>
        </div> */}
      </div>

      {/* <div>
        {needToken && (
          <div className="fixed inset-0 bg-black/50 rounded-lg flex items-center justify-center z-50">
            <div className="rounded-lg shadow-lg">
              <Turnstile
                ref={turnstileRef}
                siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
                onSuccess={(token) => {
                  if (tokenResolverRef.current) {
                    tokenResolverRef.current(token);
                    tokenResolverRef.current = null;
                  }
                  setNeedToken(false);
                }}
              />
            </div>
          </div>
        )}
      </div> */}
    </>
  );
}
