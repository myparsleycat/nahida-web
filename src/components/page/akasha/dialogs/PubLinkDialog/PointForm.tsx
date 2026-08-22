import { Save as SaveIcon, Close as XIcon } from "pixelarticons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARCA_CHANNEL_IDS,
  isArcaChannel,
  type ArcaChannel,
} from "@/lib/akasha/services/arca-channel";
import { parsePointAmountInput } from "@/lib/akasha/services/mod-points";
import { pointAmountRanges, usePointSettings } from "@/lib/akasha/services/point-settings";

interface PointFormProps {
  amount: number | null;
  channel: string | null;
  onSave: (payload: { amount: number | null; channel?: ArcaChannel }) => void | Promise<void>;
}

export function PointForm({ amount, channel, onSave }: PointFormProps) {
  const { t } = useTranslation();
  const hasAmount = amount != null;
  const lockedChannel = isArcaChannel(channel) ? channel : "";
  const [draftAmount, setDraftAmount] = useState(amount?.toString() ?? "");
  const [draftChannel, setDraftChannel] = useState<ArcaChannel | "">(lockedChannel);
  const selectedChannel = lockedChannel || draftChannel;
  const pointSettings = usePointSettings();
  const pointRange =
    selectedChannel && pointSettings.data
      ? pointAmountRanges(pointSettings.data)[selectedChannel]
      : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>{t("akasha.points.channel")}</Label>
          <Select
            value={selectedChannel || undefined}
            disabled={!!lockedChannel || !pointSettings.data}
            onValueChange={(value) => {
              if (isArcaChannel(value)) setDraftChannel(value);
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder={t("akasha.points.channel")} />
            </SelectTrigger>
            <SelectContent>
              {ARCA_CHANNEL_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(`akasha.points.channels.${id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>{t("akasha.points.amount")}</Label>
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              if (hasAmount) {
                setDraftAmount("");
                void onSave({ amount: null });
                return;
              }

              if (!isArcaChannel(selectedChannel) || !pointRange) {
                toast.warning(t("akasha.points.channelRequired"));
                return;
              }

              const parsed = parsePointAmountInput(draftAmount, pointRange);
              if (parsed === "invalid") {
                toast.warning(
                  t("akasha.points.amountRange", {
                    min: pointRange.min,
                    max: pointRange.max,
                  }),
                );
                return;
              }

              void onSave({
                amount: parsed,
                ...(parsed != null ? { channel: selectedChannel } : {}),
              });
            }}
          >
            <Input
              inputMode="numeric"
              name="amount"
              disabled={hasAmount || !pointSettings.data}
              placeholder={t("akasha.points.free")}
              onValueChange={setDraftAmount}
              value={hasAmount ? String(amount) : draftAmount}
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <button type="submit">
                {hasAmount ? <XIcon className="size-5.5" /> : <SaveIcon className="size-5.5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
