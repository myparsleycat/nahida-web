import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink as ExternalLinkIcon } from "pixelarticons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";

interface ModPointPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  accountUrl: string;
  description: string;
  verify: (ledgerId: string) => Promise<{ error?: { value: unknown } | null }>;
  onPaid: () => Promise<void> | void;
}

export function ModPointPayDialog(props: ModPointPayDialogProps) {
  const { open, onOpenChange, amount, accountUrl, description, verify, onPaid } = props;
  const { t } = useTranslation();
  const session = useSession();
  const [ledgerId, setLedgerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const loggedIn = !!session.data?.user;

  const arcaQuery = useQuery({
    queryKey: ["u:arca-link"],
    enabled: open && loggedIn,
    queryFn: async () => {
      const { data, error } = await eden.arca.link.get();
      if (error) throw error;
      return data;
    },
  });

  const linked = !!arcaQuery.data?.arcaUsername;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorCode(null);
    try {
      const { error } = await verify(ledgerId);
      if (error) {
        setErrorCode(pointErrorCode(error.value));
        return;
      }
      toast.success(t("akasha.points.paid"));
      setLedgerId("");
      await onPaid();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(44rem,calc(100vh-4rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("akasha.points.payTitle")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!loggedIn ? (
          <div className="space-y-3">
            <p>{t("akasha.points.needLogin")}</p>
            <Button type="button" asChild>
              <Link to="/sign-in" search={{ redirect: window.location.href }}>
                {t("g.login")}
              </Link>
            </Button>
          </div>
        ) : arcaQuery.isLoading ? null : !linked ? (
          <div className="space-y-3">
            <p>{t("akasha.points.needArcaLink")}</p>
            <Button type="button" asChild>
              <a href="/u">{t("akasha.points.openArcaLink")}</a>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <p>{t("akasha.points.stepSend", { amount })}</p>
              </li>
              <li>
                <p>{t("akasha.points.stepNumber")}</p>
              </li>
            </ol>

            <div className="grid gap-2">
              <Label htmlFor="ledger-id">{t("akasha.points.ledgerId")}</Label>
              <Input
                id="ledger-id"
                value={ledgerId}
                onValueChange={setLedgerId}
                placeholder="#27478"
                required
              />
            </div>

            {errorCode && (
              <p className="text-destructive">
                {t([`akasha.points.errors.${errorCode}`, "akasha.points.errors.unknown"])}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" asChild>
                <a href={accountUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  {t("akasha.points.openAccount")}
                </a>
              </Button>
              <Button type="submit" disabled={submitting || !ledgerId.trim()}>
                {t("akasha.points.verify")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function pointErrorCode(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "error" in value) {
    return String((value as { error: unknown }).error);
  }
  return "unknown";
}
