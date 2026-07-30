import { useQuery, type QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AliceLoader, Center } from "@/components/common";
import { CustomCursor } from "@/components/custom-cursor";
import { AnnouncementStack, useAnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { MobileSidePanel } from "@/components/layout/MobileSidePanel";
import { SidePanel } from "@/components/layout/SidePanel";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobileWidth } from "@/hooks/use-mobile";
import { initializeUploadSessions } from "@/lib/akasha/upload-v2/session";
import { eden } from "@/lib/eden";
import { cn } from "@/lib/utils";

function BaseComponent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeadContent />
      <Toaster position="top-center" richColors />
      {children}
    </>
  );
}

interface MyRouterContext {
  queryClient: QueryClient;
}

function RootComponent() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["nahida-init"],
    queryFn: async () => {
      const { error } = await eden.ping.get();
      if (error) {
        return false;
      } else {
        return true;
      }
    },
    retry: 1,
    retryDelay: 100,
    placeholderData: (prev) => prev,
    refetchIntervalInBackground: false,
    refetchInterval: 60000,
  });

  const isWorking = query.isLoading || query.isFetching;
  const { announcements, dismiss } = useAnnouncementBanner();
  const isMobile = useIsMobileWidth();

  useEffect(() => {
    void initializeUploadSessions();
  }, []);

  if (query.isLoading) {
    return (
      <BaseComponent>
        <CustomCursor isAppWorking={true} />
        <Center size="page-full">
          <AliceLoader />
        </Center>
      </BaseComponent>
    );
  }

  if (!query.data) {
    return (
      <BaseComponent>
        <CustomCursor isAppWorking={false} />
        <Center size="page-full">
          <div className="flex flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("g.init_failed_title")}
            </h1>
            <p className="mt-3 text-base leading-relaxed md:text-lg">
              {t("g.init_failed_description")}
            </p>
            <a
              href="https://status.nahida.live"
              className={cn(buttonVariants({ variant: "default" }), "mt-6")}
            >
              Check service status
            </a>
          </div>
        </Center>
      </BaseComponent>
    );
  } else {
    return (
      <BaseComponent>
        <CustomCursor isAppWorking={isWorking} />
        <div className="flex h-dvh w-full flex-col">
          {announcements.length > 0 && (
            <AnnouncementStack announcements={announcements} onDismiss={dismiss} />
          )}
          <main className="flex min-h-0 w-full flex-1 overflow-hidden">
            {isMobile ? <MobileSidePanel /> : <SidePanel />}

            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </BaseComponent>
    );
  }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  head: (_c) => ({
    meta: [
      { title: "나히다 라이브" },
      { name: "description", content: "3dmigoto Mods for GI, SR, Wuwa, ZZZ" },
    ],
  }),
});
