import { useLocation } from "@tanstack/react-router";
import { ExternalLink as ExternalLinkIcon } from "pixelarticons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LAST_SHOWN_STORAGE_KEY = "nhd-donation-dialog:last-shown-date";
const CHANNEL_URL = "https://arca.live/b/genshinskinmode";
const SHOW_DELAY_MS = 1200;

function getLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function hasShownToday() {
  try {
    return localStorage.getItem(LAST_SHOWN_STORAGE_KEY) === getLocalDateKey();
  } catch {
    return false;
  }
}

function markShownToday() {
  try {
    localStorage.setItem(LAST_SHOWN_STORAGE_KEY, getLocalDateKey());
  } catch {
    // ignore
  }
}

function isAuthPath(pathname: string) {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/desktop")
  );
}

export function DonationDialog() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const hideOnRoute = isAuthPath(location.pathname);

  useEffect(() => {
    if (hideOnRoute || hasShownToday()) return;

    const timeout = window.setTimeout(() => {
      if (hasShownToday()) return;
      markShownToday();
      setOpen(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [hideOnRoute]);

  return (
    <Dialog open={open && !hideOnRoute} onOpenChange={setOpen}>
      <DialogContent className="max-h-[min(44rem,calc(100vh-4rem))] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("donation.dialog.title")}</DialogTitle>
          <DialogDescription>{t("donation.dialog.intro")}</DialogDescription>
        </DialogHeader>

        <ol className="list-decimal space-y-4 pl-5">
          <li className="space-y-2">
            <p>{t("donation.dialog.step1")}</p>
            <img
              src="/img/donation/arca-channel-account.png"
              alt={t("donation.dialog.accountImageAlt")}
              className="w-full border"
            />
          </li>
          <li className="space-y-2">
            <p>{t("donation.dialog.step2")}</p>
            <img
              src="/img/donation/arca-send-points.png"
              alt={t("donation.dialog.sendImageAlt")}
              className="w-full border"
            />
          </li>
        </ol>

        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              {t("donation.dialog.openChannel")}
            </a>
          </Button>
          <Button type="button" onClick={() => setOpen(false)}>
            {t("g.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
