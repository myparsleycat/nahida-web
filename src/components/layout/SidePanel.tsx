import { Link } from "@tanstack/react-router";
import {
  CloudyIcon,
  LeafyGreenIcon,
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
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
  const { data: session } = useSession();
  const { t } = useTranslation();
  const driveRootId = session?.drive?.rootId;

  useEffect(() => {
    cleanupOldOpfsDirectories();
  }, []);

  return (
    <div className="z-10 flex h-full flex-col space-y-2 border-r bg-background p-2 shadow-xl">
      <Link to="/" className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <LeafyGreenIcon />
      </Link>

      <Link to="/akasha/mod/create" className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <UploadIcon />
      </Link>

      {driveRootId && (
        <Link
          to="/akasha/drive/$itemId"
          params={{ itemId: driveRootId }}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <CloudyIcon />
        </Link>
      )}

      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "overflow-hidden")}
          >
            <img
              referrerPolicy="no-referrer"
              src={session.user.image ? session.user.image : "/sunglasshida.jpg"}
              alt={session.user.name}
            />
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
                <LogOutIcon />
                {t("g.logout")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link
          to="/sign-in"
          search={{ redirect: window.location.href }}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <LogInIcon />
        </Link>
      )}

      <Separator />

      <AnimatedThemeToggler className={buttonVariants({ variant: "ghost", size: "icon" })} />

      <Link to="/setting" className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <SettingsIcon />
      </Link>

      <a
        href="https://nhl.fanbox.cc/"
        target="_blank"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "overflow-hidden rounded-lg",
        )}
      >
        <img src="/icon/Pixiv_FANBOX_(Icon).svg" />
      </a>
    </div>
  );
}
