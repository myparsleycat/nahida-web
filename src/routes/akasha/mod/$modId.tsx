import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";

import { AkashaModContents } from "@/components/akasha/mod-finder";
import { AkashaModInfo, Bottom } from "@/components/akasha/mod-info";
import { ModPointPayDialog } from "@/components/akasha/mod-point-pay-dialog";
import { AkashaModPwdProtect } from "@/components/akasha/mod-pwd-protect";
import { Center, ServerCrash, AliceLoader, Random1619 } from "@/components/common";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ModContext from "@/context/ModContext";
import { useIsMobileWidth } from "@/hooks/use-mobile";
import { getCachedModAccess, setCachedModAccess } from "@/lib/akasha/services/mod-access";
import { modStorage } from "@/lib/akasha/services/mod-drive/localstorage";
import {
  collectionNeedsPayment,
  requiredPointAmount,
} from "@/lib/akasha/services/mod-points";
import { eden } from "@/lib/eden";
import { base64url, cn } from "@/lib/utils";

export const Route = createFileRoute("/akasha/mod/$modId")({
  component: RouteComponent,
  shouldReload: false,
  loader: async ({ params }) => {
    const { modId } = params;

    const cachedAccess = getCachedModAccess(modId);
    const modStorageData = modStorage.getMod(modId);

    const {
      data,
      error,
      response: resp,
    } = await eden.akasha.mod({ modId }).get({
      query: {
        sig: modStorageData?.sig,
        ...(cachedAccess.password && { password: cachedAccess.password }),
      },
      ...(cachedAccess.token && { headers: { "x-token": cachedAccess.token } }),
    });

    const accessToken = resp.headers.get("x-token") ?? cachedAccess.token;
    if (!error && accessToken) {
      setCachedModAccess(modId, { password: cachedAccess.password, token: accessToken });
    }

    const previewHeader = resp.headers.get("x-preview");
    const preview: { mime: string; url: string } | undefined = previewHeader
      ? JSON.parse(previewHeader)
      : undefined;

    let errTxt = undefined;
    if (error) {
      if (error.status === 429) {
        errTxt = `${t("toast.warning.too_many_requests")}. ${t("toast.warning.retryAfter", {
          sec: error.value.retryAfter,
        })}`;
      } else {
        errTxt = error.value.toString();
      }
    }

    const payload = {
      status: resp.status,
      errTxt,
      modData: !error ? data : undefined,
      sig: modStorageData?.sig,
      preview,
      accessToken,
    };

    return payload;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.modData
      ? `${loaderData.modData.mod.title} | 나히다 라이브`
      : undefined;
    const description = loaderData?.modData ? loaderData.modData.mod.description : undefined;

    return {
      meta: [{ title }, ...(description ? [{ name: "description", content: description }] : [])],
    };
  },
});

function RouteComponent() {
  const { status, errTxt, modData, sig, preview, accessToken } = Route.useLoaderData();
  const { modId } = Route.useParams();
  const navi = useNavigate();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const isMobile = useIsMobileWidth();

  const isInitialCollectionSet = useRef(true);
  const [isOpenInfo, setOpenInfo] = useState(false);
  const [itemId, setItemId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const needsPayment = collectionNeedsPayment(modData, collectionId);
  const payAmount = requiredPointAmount(modData, collectionId);

  useEffect(() => {
    setPayOpen(needsPayment);
  }, [needsPayment, collectionId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        if (event.state.itemId) {
          setItemId(event.state.itemId);
        }

        if (event.state.collectionId) {
          setCollectionId(event.state.collectionId);
        }
      } else {
        setItemId("");
        setCollectionId("");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (modData && modData.collections.length > 0 && !collectionId) {
      setCollectionId(modData.collections[0].id);
    }
  }, [modData]);

  useEffect(() => {
    if (modData && collectionId) {
      const currentCollection = modData.collections.find((v) => v.id === collectionId);
      if (!currentCollection?.rootId) return;

      const newItemId = currentCollection.rootId;
      setItemId(newItemId);

      const currentHistoryState = window.history.state;
      const isSameState =
        currentHistoryState &&
        currentHistoryState.itemId === newItemId &&
        currentHistoryState.collectionId === collectionId;

      if (isInitialCollectionSet.current) {
        history.replaceState({ itemId: newItemId, collectionId }, "", window.location.href);
        isInitialCollectionSet.current = false;
      } else {
        if (!isSameState) {
          history.pushState({ itemId: newItemId, collectionId }, "", window.location.href);
        } else {
          history.replaceState({ itemId: newItemId, collectionId }, "", window.location.href);
        }
      }
    }
  }, [modData, collectionId]);

  const itemQuery = useQuery({
    queryKey: ["akasha", "mod", "item", itemId, accessToken],
    queryFn: async () => {
      const { data, error } = await eden.akasha.mod.item({ itemId }).get({
        headers: {
          ...(sig && { "x-sig": sig }),
          ...(accessToken && { "x-token": accessToken }),
        },
      });

      if (error) {
        if (error.status === 404) {
          await navi({
            to: "/akasha/mod/$modId",
            params: {
              modId,
            },
          });
        }

        throw new Error(error.value.toString());
      }

      return data;
    },
    placeholderData: (prev) => prev,
    enabled: !!itemId && !needsPayment,
  });

  const handleSetItemId = (newItemId: string) => {
    if (itemId === newItemId) return;
    setItemId(newItemId);
    history.pushState({ itemId: newItemId }, "", window.location.href);
  };

  const handleSetCollectionId = (newCollectionId: string) => {
    if (collectionId === newCollectionId) return;
    setCollectionId(newCollectionId);
  };

  if (status === 401)
    return <AkashaModPwdProtect modId={modId} errMsg={errTxt} preview={preview} />;
  else if (errTxt) {
    return (
      <Center>
        <ServerCrash message={errTxt} />
      </Center>
    );
  }

  const contextValue = {
    modId,
    collectionId,
    setCollectionId: handleSetCollectionId,
    itemId,
    setItemId: handleSetItemId,
    sig,
    accessToken,
    isOpenInfo,
    setOpenInfo,
    modQuery: modData,
    itemQuery: itemQuery.data,
  };

  return (
    <ModContext.Provider value={contextValue}>
      <div className="relative flex size-full flex-row">
        <div className="flex flex-1 shrink-0 flex-col">
          {needsPayment ? (
            <Center>
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => setPayOpen(true)}
              >
                {tr("akasha.points.payToAccess")}
              </button>
            </Center>
          ) : itemQuery.data ? (
            <AkashaModContents
              content={itemQuery.data.content}
              children={itemQuery.data.children}
              ancestors={itemQuery.data.ancestors}
              isFetching={itemQuery.isFetching}
              isFetched={itemQuery.isFetched}
              itemId={itemId}
            />
          ) : (
            <></>
          )}
        </div>

        {modData && needsPayment && payAmount != null && (
          <ModPointPayDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            modId={modId}
            collectionId={modData.points.scope === "collection" ? collectionId : undefined}
            amount={payAmount}
            scope={modData.points.scope === "collection" ? "collection" : "mod"}
            onPaid={async () => {
              setPayOpen(false);
              await router.invalidate();
            }}
          />
        )}

        {isMobile ? (
          <Sheet open={isOpenInfo} onOpenChange={setOpenInfo}>
            <SheetContent side="right" className="flex w-80 flex-col p-0 sm:max-w-sm">
              <SheetTitle className="sr-only">Mod info</SheetTitle>
              {modData && <AkashaModInfo className="min-h-0 flex-1" data={modData} />}
              <div className="flex w-full shrink-0 items-center justify-center">
                <Bottom />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <div
            className={cn(
              "bg-material-medium z-10 flex min-h-0 shrink-0 flex-col overflow-hidden transition-all duration-500",
              modData ? "w-80" : "w-0",
            )}
          >
            {modData && <AkashaModInfo className="min-h-0 flex-1" data={modData} />}

            <div className="flex w-full shrink-0 items-center justify-center">
              <Bottom />
            </div>
          </div>
        )}
      </div>
    </ModContext.Provider>
  );
}
