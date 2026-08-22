import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  ARCA_CHANNEL_IDS,
  isArcaChannel,
  type ArcaChannel,
} from "@/lib/akasha/services/arca-channel";
import { authClient } from "@/lib/auth-client";
import { eden } from "@/lib/eden";

export function ArcaLink() {
  const { t } = useTranslation();
  const clipboard = useClipboard();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [keyRemainingSec, setKeyRemainingSec] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<ArcaChannel | "">("");

  const query = useQuery({
    queryKey: ["u:arca-link"],
    queryFn: async () => {
      const { data, error } = await eden.arca.link.get();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const tick = () => {
      setCooldownSec(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    };
    tick();
    if (cooldownUntil <= Date.now()) return;
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const pendingKey = query.data?.pendingKey ?? null;
  const pendingChannel = isArcaChannel(query.data?.channel) ? query.data.channel : null;
  const articleUrl = query.data?.articleUrl ?? null;
  const arcaUsername = query.data?.arcaUsername ?? null;
  const keyExpiresAt = query.data?.expiresAt ?? 0;
  const channel = pendingChannel ?? selectedChannel;

  useEffect(() => {
    const tick = () => {
      setKeyRemainingSec(Math.max(0, Math.ceil((keyExpiresAt - Date.now()) / 1000)));
    };
    tick();
    if (keyExpiresAt <= Date.now()) return;
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [keyExpiresAt]);

  useEffect(() => {
    if (!pendingKey || keyExpiresAt > Date.now()) return;
    void query.refetch();
  }, [keyRemainingSec, pendingKey, keyExpiresAt]);

  const startCooldown = (seconds: number) => {
    setCooldownUntil(Date.now() + seconds * 1000);
  };

  const handleIssue = async () => {
    if (!isArcaChannel(channel)) return;
    const { error } = await eden.arca.link.issue.post({ channel });
    if (error) {
      toast.error(t("u.arca_unavailable"));
      return;
    }
    await query.refetch();
    toast.success(t("u.arca_key_issued"));
  };

  const handleCopy = async () => {
    if (!pendingKey) return;
    const result = await clipboard.copy(pendingKey);
    if (result === "success") toast.success(t("u.arca_copied"));
  };

  const handleVerify = async () => {
    if (cooldownSec > 0) return;

    const { data, error } = await eden.arca.link.verify.post();
    if (error) {
      const retryAfter = readRetryAfter(error);
      startCooldown(retryAfter);
      if (error.status === 429) {
        toast.warning(t("toast.warning.retryAfter", { sec: retryAfter }));
        return;
      }
      if (error.status === 404) {
        toast.error(t("u.arca_not_found"));
        return;
      }
      if (error.status === 409) {
        toast.error(t("u.arca_conflict"));
        return;
      }
      toast.error(t("u.arca_unavailable"));
      return;
    }

    startCooldown(60);
    await Promise.all([query.refetch(), authClient.getSession()]);
    toast.success(t("u.arca_linked", { username: linkedUsername(data) }));
  };

  const handleUnlink = async () => {
    const { error } = await eden.arca.link.unlink.post();
    if (error) {
      toast.error(t("u.arca_unavailable"));
      return;
    }
    setSelectedChannel("");
    await Promise.all([query.refetch(), authClient.getSession()]);
    toast.success(t("u.arca_unlinked"));
  };

  return (
    <div className="flex items-center gap-4 sm:gap-16">
      <div className="flex-1">
        <Label>{t("u.arca_link")}</Label>
      </div>
      <div className="flex w-48 flex-col items-end gap-2 md:w-64">
        {arcaUsername ? (
          <>
            <Input disabled value={arcaUsername} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">{t("u.arca_unlink")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("u.arca_unlink_confirm_title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("u.arca_unlink_confirm_description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={async () => {
                      await handleUnlink();
                    }}
                  >
                    {t("u.arca_unlink")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <>
            <Select
              value={channel || undefined}
              onValueChange={(value) => {
                if (!pendingKey && isArcaChannel(value)) setSelectedChannel(value);
              }}
              disabled={!!pendingKey}
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("u.arca_channel")} />
              </SelectTrigger>
              <SelectContent>
                {ARCA_CHANNEL_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {t(`u.arca_channels.${id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingKey ? (
              <>
                <Input disabled value={pendingKey} />
                <p className="text-sm text-muted-foreground tabular-nums">
                  {t("u.arca_expires_in", { time: formatCountdown(keyRemainingSec) })}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClickPromise={handleCopy}>
                    {t("u.arca_copy_key")}
                  </Button>
                  {articleUrl ? (
                    <Button variant="outline" asChild>
                      <a href={articleUrl} target="_blank" rel="noreferrer">
                        {t("u.arca_open_post")}
                      </a>
                    </Button>
                  ) : null}
                  <Button onClickPromise={handleVerify} disabled={cooldownSec > 0}>
                    {cooldownSec > 0
                      ? t("u.arca_verify_cooldown", { sec: cooldownSec })
                      : t("u.arca_verify")}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClickPromise={handleIssue}
                isLoading={query.isLoading}
                disabled={!isArcaChannel(channel)}
              >
                {t("u.arca_issue_key")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function linkedUsername(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    "arcaUsername" in data &&
    typeof data.arcaUsername === "string"
  ) {
    return data.arcaUsername;
  }
  return "";
}

function formatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readRetryAfter(error: { status: number; value: unknown }): number {
  if (
    error.status === 429 &&
    error.value &&
    typeof error.value === "object" &&
    "retryAfter" in error.value &&
    typeof error.value.retryAfter === "number"
  ) {
    return error.value.retryAfter;
  }
  return 60;
}
