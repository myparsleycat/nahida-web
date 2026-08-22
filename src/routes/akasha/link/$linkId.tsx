import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Content } from "@/lib/akasha";

import { ModPointPayDialog } from "@/components/akasha/mod-point-pay-dialog";
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
  const [needToken, setNeedToken] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payRequired, setPayRequired] = useState(false);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payAccountUrl, setPayAccountUrl] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const busyRef = useRef(false);
  const [currentId, setCurrentId] = useState("");
  const [linkParent, setLinkParent] = useState<{ id: string; name: string } | null>(null);
  const tokenResolverRef = useRef<((token: string) => void) | null>(null);
  const tokenRejectRef = useRef<((error: Error) => void) | null>(null);

  const link = useMemo(() => {
    return { linkId, token };
  }, [linkId, token]);

  useEffect(() => {
    void initializeExplorer();
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.currentId) {
        setCurrentId(event.state.currentId);
        return;
      }
      if (linkParent) setCurrentId(linkParent.id);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [linkParent]);

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
    turnstileRef.current?.reset();
    setNeedToken(false);
    tokenResolverRef.current = null;
    tokenRejectRef.current = null;
  }

  function getTurnstileToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      tokenResolverRef.current = resolve;
      tokenRejectRef.current = reject;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setNeedToken(true);
    });
  }

  function failTurnstile() {
    toast.warning(t("toast.warning.failure_turnstile"));
    tokenRejectRef.current?.(new Error("turnstile_failed"));
    tokenRejectRef.current = null;
    tokenResolverRef.current = null;
    setNeedToken(false);
  }

  function enterRoot(parentId: string) {
    setCurrentId(parentId);
    history.replaceState({ ...history.state, currentId: parentId }, "", window.location.href);
  }

  function handleNavi(newId: string) {
    if (currentId === newId) return;
    setCurrentId(newId);
    history.pushState({ ...history.state, currentId: newId }, "", window.location.href);
  }

  async function initializeExplorer() {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setCanRetry(false);

    try {
      const cachedData = sessionStorage.getItem(`linkData-${linkId}`);
      if (cachedData) {
        const { cachedToken, cachedParent, expirationTime } = JSON.parse(cachedData);
        if (Date.now() > expirationTime) {
          sessionStorage.removeItem(`linkData-${linkId}`);
        } else {
          setToken(cachedToken);
          setLinkParent(cachedParent);
          enterRoot(cachedParent.id);
          setFirstLoading(false);
          return;
        }
      }

      const requestAccess = (cftoken: string) =>
        eden.akasha.link({ linkId }).post({
          password: inPwd,
          cftoken,
        });

      const postWithTurnstile = async () => requestAccess(await getTurnstileToken());

      let result = inPwd ? await postWithTurnstile() : await requestAccess("");

      if (result.error?.value === "cftoken_required" && !inPwd) {
        result = await postWithTurnstile();
      }

      while (
        result.error?.value === "invalid_cftoken" ||
        result.error?.value === "cftoken_required"
      ) {
        toast.warning(
          result.error.value === "invalid_cftoken"
            ? t("toast.warning.failure_turnstile")
            : t("toast.warning.missing_cftoken"),
        );
        result = await postWithTurnstile();
      }

      if (result.error) {
        if (result.error.status === 429) {
          const msg = t("toast.warning.retryAfter", {
            sec: result.error.value.retryAfter,
          });
          toast.warning(t("toast.warning.too_many_requests"), {
            description: msg,
          });
          setMsg(msg);
          setReqPwd(true);
          return;
        }

        if (result.error.status === 402 && isPaymentRequired(result.error.value)) {
          setReqPwd(false);
          setPayRequired(true);
          setPayAmount(result.error.value.amount);
          setPayAccountUrl(result.error.value.accountUrl);
          setPayOpen(true);
          return;
        }

        switch (result.error.value) {
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
            const text = result.error.value.toString();
            toast.warning(text);
            if (!inPwd) {
              setErrMsg(text);
              break;
            }
            setMsg(text);
        }
        return;
      }

      setReqPwd(false);
      setPayRequired(false);
      setPayOpen(false);
      const newToken = result.data.token;
      const newParent = result.data.parent;

      setToken(newToken);
      setLinkParent(newParent);
      enterRoot(newParent.id);

      const expirationTime = Date.now() + 12 * 60 * 60 * 1000;

      sessionStorage.setItem(
        `linkData-${linkId}`,
        JSON.stringify({
          cachedToken: newToken,
          cachedParent: newParent,
          expirationTime,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message === "turnstile_failed") {
        if (!inPwd) setCanRetry(true);
        return;
      }
      const text = error instanceof Error ? error.message : String(error);
      setErrMsg(text);
      toast.error(text);
    } finally {
      busyRef.current = false;
      setIsBusy(false);
      cfReset();
      setFirstLoading(false);
    }
  }

  async function handlePasswordSubmit() {
    if (busyRef.current) return;
    if (!inPwd) {
      toast.warning(t("toast.warning.pw_is_required"));
      return;
    }
    await initializeExplorer();
  }

  async function handleOpenRetry() {
    if (busyRef.current) return;
    setFirstLoading(true);
    await initializeExplorer();
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {firstLoading && !reqPwd && !payOpen && !payRequired && (
          <Center>
            <AliceLoader />
          </Center>
        )}

        {errMsg && (
          <Center className="w-full">
            <AlertWithRandom1619 message={errMsg} />
          </Center>
        )}

        {canRetry && !reqPwd && !errMsg && !payRequired && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-100 flex-col gap-y-4">
              <p>{t("toast.warning.failure_turnstile")}</p>
              <Button disabled={isBusy} onClick={() => void handleOpenRetry()}>
                {t("g.continue")}
              </Button>
            </div>
          </div>
        )}

        {payRequired && !payOpen && payAmount != null && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-100 flex-col gap-y-4">
              <p>{t("akasha.points.payLinkDescription", { amount: payAmount })}</p>
              <Button disabled={isBusy} onClick={() => setPayOpen(true)}>
                {t("akasha.points.payToAccess")}
              </Button>
            </div>
          </div>
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
                  disabled={isBusy || needToken}
                  value={inPwd}
                  onChange={(e) => setInPwd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handlePasswordSubmit();
                    }
                  }}
                />
                <Button disabled={isBusy || needToken} onClick={() => void handlePasswordSubmit()}>
                  {t("g.continue")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          {query.data && !firstLoading && !reqPwd && !payRequired && (
            <ShareLinkContents
              link={link}
              content={query.data.content as Content}
              children={query.data.children}
              ancestors={query.data.ancestors}
              isFetched={query.isFetched}
              isFetching={query.isFetching}
              navi={handleNavi}
              currentId={currentId}
            />
          )}
        </div>
      </div>

      {payAmount != null && (
        <ModPointPayDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          amount={payAmount}
          accountUrl={payAccountUrl}
          description={t("akasha.points.payLinkDescription", { amount: payAmount })}
          verify={(ledgerId) => eden.akasha.link({ linkId }).points.verify.post({ ledgerId })}
          onPaid={async () => {
            setPayOpen(false);
            setPayRequired(false);
            setFirstLoading(true);
            await initializeExplorer();
          }}
        />
      )}

      <div>
        {needToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center rounded-lg bg-black/50">
            <div className="rounded-lg shadow-lg">
              <Turnstile
                ref={turnstileRef}
                siteKey="0x4AAAAAAAQ2y1gqLezBfMo4"
                onSuccess={(token) => {
                  if (tokenResolverRef.current) {
                    tokenResolverRef.current(token);
                    tokenResolverRef.current = null;
                    tokenRejectRef.current = null;
                  }
                  setNeedToken(false);
                }}
                onExpire={() => turnstileRef.current?.reset()}
                onError={() => failTurnstile()}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function isPaymentRequired(value: unknown): value is {
  error: "payment_required";
  amount: number;
  accountUrl: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as { error?: unknown; amount?: unknown; accountUrl?: unknown };
  return (
    record.error === "payment_required" &&
    typeof record.amount === "number" &&
    typeof record.accountUrl === "string"
  );
}
