import { Link } from "@tanstack/react-router";
import {
  Cloud as CloudyIcon,
  Leaf as LeafyGreenIcon,
  Login as LogInIcon,
  Logout as LogOutIcon,
  Settings2 as SettingsIcon,
  Sliders as SlidersIcon,
  Upload as UploadIcon,
} from "pixelarticons/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { signOut, useSession } from "@/lib/auth-client";
import { cleanupOldOpfsDirectories } from "@/lib/opfs";
import { cn } from "@/lib/utils";

export function SidePanel() {
  useEffect(() => {
    void cleanupOldOpfsDirectories().catch((error) => {
      console.error("Failed to clean up old OPFS directories:", error);
    });
  }, []);

  return (
    <div className="z-10 flex h-full flex-col space-y-2 border-r bg-background p-2 shadow-xl">
      <SidePanelContent />
    </div>
  );
}

interface SidePanelContentProps {
  labeled?: boolean;
}

export function SidePanelContent(props: SidePanelContentProps) {
  const { labeled = false } = props;
  const { data: session } = useSession();
  const { t } = useTranslation();
  const driveRootId = session?.drive?.rootId;

  const linkClass = labeled
    ? cn(buttonVariants({ variant: "ghost" }), "flex w-full justify-start gap-3 px-3")
    : buttonVariants({ variant: "ghost", size: "icon-lg" });

  return (
    <>
      <Link to="/" className={linkClass}>
        <LeafyGreenIcon className="size-6" />
        {labeled && <span>{t("g.home")}</span>}
      </Link>

      <Link to="/akasha/mod/create" className={linkClass}>
        <UploadIcon className="size-6" />
        {labeled && <span>{t("g.upload")}</span>}
      </Link>

      {driveRootId && (
        <Link to="/akasha/drive/$itemId" params={{ itemId: driveRootId }} className={linkClass}>
          <CloudyIcon className="size-6" />
          {labeled && <span>{t("g.nahida_drive")}</span>}
        </Link>
      )}

      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              labeled
                ? cn(buttonVariants({ variant: "ghost" }), "flex w-full justify-start gap-3 px-3")
                : cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "overflow-hidden"),
              labeled && "overflow-hidden",
            )}
          >
            <img
              referrerPolicy="no-referrer"
              src={session.user.image ? session.user.image : "/sunglasshida.jpg"}
              alt={session.user.name}
            />
            {labeled && <span className="truncate text-sm">{session.user.name}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/u" className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="flex items-center justify-center">
                    <img
                      referrerPolicy="no-referrer"
                      src={session.user.image ? session.user.image : "/sunglasshida.jpg"}
                      alt={session.user.name}
                    />
                  </Avatar>
                  <div className="flex min-w-0 flex-col items-start">
                    <div className="w-full truncate text-start text-sm leading-5 font-medium">
                      {session.user.email}
                    </div>
                    <span className="h-4 text-[13px] leading-4 font-medium text-gray-500">
                      {session.user.name}
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer gap-x-2"
                onClick={async () => await signOut()}
              >
                <LogOutIcon className="size-6" />
                {t("g.logout")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link to="/sign-in" search={{ redirect: window.location.href }} className={linkClass}>
          <LogInIcon className="size-6" />
          {labeled && <span>{t("g.login")}</span>}
        </Link>
      )}

      <Separator />

      <div className={cn("flex items-center gap-3", labeled ? "px-3" : "")}>
        <AnimatedThemeToggler className={buttonVariants({ variant: "ghost", size: "icon-lg" })} />
        {labeled && <span className="text-sm">{t("g.theme")}</span>}
      </div>

      {session?.user.role === "staff" && (
        <Link to="/admin" className={linkClass}>
          <SlidersIcon className="size-6" />
          {labeled && <span>{t("g.admin")}</span>}
        </Link>
      )}

      <Link to="/setting" className={linkClass}>
        <SettingsIcon className="size-6" />
        {labeled && <span>{t("g.settings")}</span>}
      </Link>

      <a
        href="https://nhl.fanbox.cc/"
        target="_blank"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-lg" }),
          labeled && "flex w-full justify-start gap-3 px-3",
          "overflow-hidden rounded-lg",
        )}
      >
        <img src="/icon/Pixiv_FANBOX_(Icon).svg" className="size-6" />
        {labeled && <span className="text-sm">{t("g.fanbox")}</span>}
      </a>
    </>
  );
}
