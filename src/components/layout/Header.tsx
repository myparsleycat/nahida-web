import { AvatarFallback } from "@radix-ui/react-avatar";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Cloud as CloudyIcon,
  Leaf as LeafyGreenIcon,
  Login as LogInIcon,
  Logout as LogOutIcon,
  Upload as UploadIcon,
} from "pixelarticons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowScroll } from "react-use";

import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { Dock, DockIcon } from "@/components/magicui/dock";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";

export default function Header() {
  const { y: scrollY } = useWindowScroll();
  const location = useLocation();
  const [headerOpacity, setHeaderOpacity] = useState(0);
  const [borderBool, setBorderBool] = useState(true);
  const { data: session } = useSession();
  const driveRootId = session?.drive?.rootId;
  const { t } = useTranslation();
  const { setLoginDialogOpen } = useUIStore();

  const SCROLL_THRESHOLD = 40;

  useEffect(() => {
    setHeaderOpacity(Math.min(scrollY / SCROLL_THRESHOLD, 1));
    setBorderBool(scrollY < SCROLL_THRESHOLD);
  }, [scrollY]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[9] mr-[var(--removed-body-scroll-bar-size)] h-[4.5rem] transition-shadow duration-200">
      <div
        className="bg-themed-bg_opacity pointer-events-none absolute inset-0 transform-gpu bg-background [-webkit-backdrop-filter:saturate(180%)_blur(20px)] [backface-visibility:hidden] [border-bottom:1px_solid_rgb(187_187_187_/_20%)] dark:bg-transparent dark:[backdrop-filter:saturate(180%)_blur(20px)]"
        style={{ opacity: headerOpacity }}
      ></div>

      <div className="pointer-events-none flex h-full min-h-0 items-center justify-center">
        <div className="pointer-events-none relative w-full items-center justify-center">
          <Dock
            direction="middle"
            className={cn(
              "pointer-events-auto relative shadow-none transition-shadow duration-150 ease-in-out",
              borderBool && "shadow-xl dark:shadow-none",
            )}
            borderBool={borderBool}
          >
            <DockIcon>
              <Link to="/" className="inline-flex h-full w-full items-center justify-center">
                <LeafyGreenIcon width={22} height={22} />
              </Link>
            </DockIcon>

            <DockIcon>
              <Link
                to="/akasha/mod/create"
                className="inline-flex h-full w-full items-center justify-center"
              >
                <UploadIcon width={22} height={22} />
              </Link>
            </DockIcon>

            <Separator
              orientation="vertical"
              className="h-full w-[0.6px] bg-black/20 dark:bg-white/20"
            />

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="mx-2">
                  <Avatar className="size-7">
                    <img
                      referrerPolicy="no-referrer"
                      src={session.user.image ? session.user.image : "/sunglasshida.jpg"}
                      alt={session.user.name}
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to="/u" className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="size-7">
                          <img
                            referrerPolicy="no-referrer"
                            src={session.user.image ? session.user.image : "/sunglasshida.jpg"}
                            alt={session.user.name}
                          />
                          <AvatarFallback>CN</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col items-start">
                          <div className="w-full truncate text-start text-sm leading-[20px] font-medium">
                            {session.user.email}
                          </div>
                          <span className="h-4 text-[13px] leading-[16px] font-medium text-gray-500">
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
                      <LogOutIcon />
                      {t("g.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DockIcon>
                <Link
                  to="/sign-in"
                  search={{ redirect: window.location.href }}
                  className="inline-flex h-full w-full items-center justify-center"
                >
                  <LogInIcon width={22} height={22} />
                </Link>
              </DockIcon>
            )}

            <DockIcon>
              <div className="inline-flex h-full w-full items-center justify-center">
                <AnimatedThemeToggler size={22} />
              </div>
            </DockIcon>

            {driveRootId && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-full w-[0.6px] bg-black/20 dark:bg-white/20"
                />

                <DockIcon>
                  <Link
                    to="/akasha/drive/$itemId"
                    params={{ itemId: driveRootId }}
                    className="inline-flex h-full w-full items-center justify-center"
                  >
                    <CloudyIcon width={22} height={22} />
                  </Link>
                </DockIcon>
              </>
            )}
          </Dock>
        </div>
      </div>
    </header>
  );
}
