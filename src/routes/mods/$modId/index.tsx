import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { UnlinkIcon } from "lucide-react";

import { Center, ServerCrash, AliceLoader, Random1619 } from "@/components/common";
import {
  Buttons,
  Description,
  Expires,
  Preview,
  Size,
  SwapKey,
  Title,
  VT,
} from "@/components/page/ModPage";
import { eden } from "@/lib/eden";

export const Route = createFileRoute("/mods/$modId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const modId = Route.useParams().modId;

  const modQuery = useQuery({
    queryKey: ["mod", modId],
    queryFn: async () => {
      const { data, error } = await eden.hello({ uuid: modId }).get();

      if (error) {
        if (error.status === 404) {
          return null;
        } else {
          throw new Error(error.value.toString());
        }
      }

      return data.mod;
    },
  });

  // let mounted = false;

  // useEffect(() => {
  //   if (modQuery.data?.modder?.id !== session.data?.user.id) {
  //     // @ts-ignore
  //     (window.adsbygoogle = window.adsbygoogle || []).push({});
  //   }
  // }, [modQuery.data, session.data?.user.id]);

  if (modQuery.isLoading) {
    return (
      <Center size="page-full">
        <AliceLoader />
      </Center>
    );
  }

  if (modQuery.error) {
    return (
      <Center size="page-full">
        <ServerCrash />
      </Center>
    );
  }

  if (!modQuery.data) {
    return (
      <Center size="page-full">
        <div className="flex grow flex-col items-center justify-center p-4">
          <UnlinkIcon size="80" />
          <h3 className="mt-8 text-2xl">잘못된 URL</h3>
          <h5 className="mt-2 text-lg">URL을 다시 확인하세요</h5>
        </div>
      </Center>
    );
  }

  if (modQuery.data.expired) {
    return (
      <>
        <div className="flex min-h-[calc(100vh-4.5rem)] w-full items-center justify-center p-6 pt-18 pb-28">
          <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-center">
            <Random1619 className="m-8 size-50 rounded-lg select-none" alt="expired alert hida" />
            <p className="text-2xl">Expired Content</p>
            {modQuery.data.expires_at && (
              <p className="text-base text-pretty">
                This content expired on {format(modQuery.data.expires_at * 1000, "yyyy-MM-dd")}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (modQuery.data) {
    return (
      <>
        <div className="flex min-h-[calc(100vh-4.5rem)] w-full items-center justify-center p-6 pt-18 pb-28">
          <div className="relative h-full w-full">
            <div className="flex h-full flex-col items-center justify-center overflow-auto">
              <div className="flex max-w-full flex-col">
                <div
                  className={
                    "top-0 right-0 bottom-0 left-0 grid w-full grid-cols-1 gap-3 overflow-hidden rounded-xl p-4 will-change-auto sm:h-175  sm:grid-cols-9 sm:grid-rows-8 xl:w-325"
                  }
                >
                  <div className="col-span-3 row-span-6 rounded-lg">
                    <Preview modData={modQuery.data} />
                  </div>
                  <VT modData={modQuery.data} />
                  <Expires modData={modQuery.data} />
                  <Title modData={modQuery.data} />
                  <Size modData={modQuery.data} />
                  <Description modData={modQuery.data} mobile />
                  <SwapKey modData={modQuery.data} />
                  <Buttons modData={modQuery.data} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}
