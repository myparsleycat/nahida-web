import { Link } from "@tanstack/react-router";
import { Close as X } from "pixelarticons/react";
import { useState } from "react";

import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type DismissPolicy = "permanent" | "weekly";

interface AnnouncementDefinition {
  id: string;
  dismissPolicy: DismissPolicy;
  render: (isLoggedIn: boolean) => React.ReactNode;
}

const announcements: AnnouncementDefinition[] = [
  {
    id: "drive-promo",
    dismissPolicy: "weekly",
    render: (isLoggedIn) => (
      <>
        Try{" "}
        <Link className="font-semibold underline" to={isLoggedIn ? "/akasha/drive" : "/akasha"}>
          Nahida Drive
        </Link>{" "}
        for unlimited mod backup and sharing, and{" "}
        <a
          className="font-semibold underline"
          href="https://github.com/myparsleycat/nahida-desktop"
          target="_blank"
          rel="noreferrer"
        >
          Nahida Desktop
        </a>
        , an integrated mod manager!
      </>
    ),
  },
  // {
  //   id: "firefox-support",
  //   dismissPolicy: "weekly",
  //   render: () => (
  //     <div className="flex items-center gap-x-2">
  //       Nahida Drive now supports <img src="/icon/firefox.svg" className="size-4.5"></img> Firefox.
  //     </div>
  //   ),
  // },
];

const getPermanentDismissKey = (id: string) => `nhd-announcement:${id}:dismissed`;
const getWeeklyDismissKey = (id: string) => `nhd-announcement:${id}:dismissed-weekly`;

export function useAnnouncementBanner() {
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return announcements
        .filter((announcement) => {
          if (localStorage.getItem(getPermanentDismissKey(announcement.id)) === "true") {
            return true;
          }

          const weeklyStr = localStorage.getItem(getWeeklyDismissKey(announcement.id));
          if (weeklyStr) {
            const timestamp = parseInt(weeklyStr, 10);
            if (!isNaN(timestamp) && Date.now() - timestamp < ONE_WEEK_MS) {
              return true;
            }

            localStorage.removeItem(getWeeklyDismissKey(announcement.id));
          }

          return false;
        })
        .map((announcement) => announcement.id);
    } catch {
      return [];
    }
  });

  const dismiss = (id: string) => {
    const announcement = announcements.find((item) => item.id === id);
    if (!announcement) {
      return;
    }

    try {
      if (isLoggedIn || announcement.dismissPolicy === "permanent") {
        localStorage.setItem(getPermanentDismissKey(id), "true");
      } else {
        localStorage.setItem(getWeeklyDismissKey(id), Date.now().toString());
      }
    } catch {
      // ignore
    }

    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return {
    announcements: announcements.filter((announcement) => !dismissedIds.includes(announcement.id)),
    dismiss,
  };
}

interface AnnouncementBannerProps {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
}

export function AnnouncementBanner({ children, onDismiss, className }: AnnouncementBannerProps) {
  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center",
        "h-9 px-10",
        "border-b bg-card",
        "text-sm font-medium text-white",
        className,
      )}
    >
      <span className="truncate text-center leading-none">{children}</span>

      <button
        onClick={onDismiss}
        aria-label="닫기"
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2",
          "flex items-center justify-center",
          "rounded p-0.5",
          "opacity-80 transition-opacity hover:opacity-100",
          "focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none",
        )}
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

interface AnnouncementStackProps {
  announcements: AnnouncementDefinition[];
  onDismiss: (id: string) => void;
}

export function AnnouncementStack({ announcements, onDismiss }: AnnouncementStackProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  return (
    <div className="flex w-full shrink-0 flex-col">
      {announcements.map((announcement) => (
        <AnnouncementBanner
          key={announcement.id}
          onDismiss={() => onDismiss(announcement.id)}
          className="first:border-t-0"
        >
          {announcement.render(isLoggedIn)}
        </AnnouncementBanner>
      ))}
    </div>
  );
}
