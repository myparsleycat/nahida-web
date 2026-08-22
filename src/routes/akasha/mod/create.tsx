import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InfoBox } from "pixelarticons/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Center, Random1619 } from "@/components/common";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import TagsInput from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ARCA_CHANNEL_IDS,
  isArcaChannel,
  type ArcaChannel,
} from "@/lib/akasha/services/arca-channel";
import { modStorage } from "@/lib/akasha/services/mod-drive/localstorage";
import { pointAmountRanges, usePointSettings } from "@/lib/akasha/services/point-settings";
import { useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";

export const Route = createFileRoute("/akasha/mod/create")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "업로드 | 나히다 라이브" }],
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const navi = useNavigate();
  const session = useSession();
  const loggedIn = !!session.data?.user;
  const pointSettings = usePointSettings();
  const pointRanges = pointSettings.data ? pointAmountRanges(pointSettings.data) : null;

  interface Values {
    title: string;
    tags: Array<string>;
    description: string | undefined;
    expires: Date | undefined;
    password: string | undefined;
    pointScope: "none" | "mod";
    pointAmount: string;
    pointChannel: ArcaChannel | "";
  }

  const defaultValues: Values = {
    title: "",
    tags: [],
    description: undefined,
    expires: undefined,
    password: undefined,
    pointScope: "none",
    pointAmount: "",
    pointChannel: "",
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const { title, tags, description, expires, password, pointScope, pointAmount, pointChannel } =
        value;

      const points =
        loggedIn && pointScope === "mod" && isArcaChannel(pointChannel)
          ? { scope: "mod" as const, amount: Number(pointAmount), channel: pointChannel }
          : loggedIn
            ? { scope: "none" as const }
            : undefined;

      const { data, error } = await eden.akasha.mod.create.post({
        title,
        tags,
        description,
        expires,
        password,
        points,
      });

      if (error || !data || typeof data !== "object") {
        toast.error(error?.value?.toString() ?? "오류가 발생했습니다");
        return;
      }

      const { modId, sig } = data;

      if (sig) {
        modStorage.setMod(modId, { sig });
      }

      await navi({
        to: "/akasha/mod/$modId",
        params: { modId },
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    form.handleSubmit().catch((err) => {
      toast.warning(err.message);
    });
  };

  function FieldInfo({ field }: { field: AnyFieldApi }) {
    return (
      <>
        {field.state.meta.isTouched && !field.state.meta.isValid ? (
          <em className="text-destructive">{field.state.meta.errors.join(", ")}</em>
        ) : null}
        {field.state.meta.isValidating ? "Validating..." : null}
      </>
    );
  }

  return (
    <Center size="page-full">
      <form className="flex w-lg flex-col space-y-6 rounded-lg border p-6" onSubmit={handleSubmit}>
        <form.Field
          name="title"
          validators={{
            onChange: ({ value }) => {
              if (!value) {
                return "타이틀을 입력해 주세요";
              } else if (value.length > 255) {
                return "타이틀은 최대 255자까지 입력할 수 있습니다";
              }
            },
            onChangeAsyncDebounceMs: 500,
          }}
          children={(f) => {
            return (
              <div className="w-fullitems-center grid gap-2">
                <Label htmlFor={f.name}>{t("upload.title")}</Label>
                <Input
                  id={f.name}
                  name={f.name}
                  // placeholder={t('g.required')}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  required
                />
                <FieldInfo field={f} />
              </div>
            );
          }}
        />

        <form.Field
          name="tags"
          validators={{
            onChange: ({ value }) => {
              if (value.length === 0) {
                return "태그를 최소 1개 이상 입력해 주세요";
              }
            },
            onChangeAsyncDebounceMs: 500,
          }}
          children={(f) => {
            return (
              <div className="w-fullitems-center grid gap-2">
                <Label htmlFor={f.name}>{t("upload.tags")}</Label>
                <TagsInput
                  value={f.state.value}
                  onValueChange={f.handleChange}
                  className="w-full"
                />
                <FieldInfo field={f} />
              </div>
            );
          }}
        />

        <form.Field
          name="description"
          validators={{
            onChange: ({ value }) => {
              if (value && value.length > 2500) {
                return "설명은 최대 2500자까지 작성할 수 있습니다";
              }
            },
            onChangeAsyncDebounceMs: 500,
          }}
          children={(f) => {
            return (
              <div className="w-fullitems-center grid gap-2">
                <Label htmlFor={f.name}>{t("upload.description")}</Label>
                <Textarea
                  id={f.name}
                  rows={3}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
                <FieldInfo field={f} />
              </div>
            );
          }}
        />

        <form.Field
          name="expires"
          validators={{
            onChange: ({ value }) => {
              if (value && new Date(value) < new Date()) {
                return "만료일 설정 오류";
              }
            },
            onChangeAsyncDebounceMs: 500,
          }}
          children={(f) => {
            return (
              <div className="w-fullitems-center grid gap-2">
                <Label htmlFor={f.name}>{t("upload.expiration_date")}</Label>
                <DatePicker
                  className="w-full"
                  value={f.state.value}
                  onChange={f.handleChange}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const sevenDaysLater = new Date(today);
                    sevenDaysLater.setDate(today.getDate() + 7);

                    return date < sevenDaysLater;
                  }}
                />
                <FieldInfo field={f} />
              </div>
            );
          }}
        />

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              if (value && value.length > 255) {
                return "비밀번호는 최대 255자까지 입력할 수 있습니다";
              }
            },
            onChangeAsyncDebounceMs: 500,
          }}
          children={(f) => {
            return (
              <div className="w-fullitems-center grid gap-2">
                <Label htmlFor={f.name}>{t("g.password")}</Label>
                <Input id={f.name} value={f.state.value} onValueChange={f.handleChange} />
                <FieldInfo field={f} />
              </div>
            );
          }}
        />

        {loggedIn && (
          <>
            <form.Field
              name="pointScope"
              children={(f) => (
                <div className="w-fullitems-center grid gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={f.name}>{t("akasha.points.scope")}</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <InfoBox className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("akasha.points.scopeHelp")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={f.state.value}
                    onValueChange={(value) => f.handleChange(value as "none" | "mod")}
                  >
                    <SelectTrigger id={f.name} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("akasha.points.scopeNone")}</SelectItem>
                      <SelectItem value="mod">{t("akasha.points.scopeMod")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldInfo field={f} />
                </div>
              )}
            />

            <form.Subscribe
              selector={(s) => s.values.pointScope}
              children={(pointScope) =>
                pointScope === "mod" ? (
                  <>
                    <form.Field
                      name="pointChannel"
                      validators={{
                        onChange: ({ value }) => {
                          if (!isArcaChannel(value)) return t("akasha.points.channelRequired");
                        },
                      }}
                      children={(f) => (
                        <div className="w-fullitems-center grid gap-2">
                          <Label htmlFor={f.name}>{t("akasha.points.channel")}</Label>
                          <Select
                            value={f.state.value || undefined}
                            onValueChange={(value) => {
                              if (isArcaChannel(value)) f.handleChange(value);
                            }}
                            required
                          >
                            <SelectTrigger id={f.name} className="w-full">
                              <SelectValue placeholder={t("akasha.points.channel")} />
                            </SelectTrigger>
                            <SelectContent>
                              {ARCA_CHANNEL_IDS.map((id) => (
                                <SelectItem key={id} value={id}>
                                  {t(`akasha.points.channelOptions.${id}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldInfo field={f} />
                        </div>
                      )}
                    />
                    <form.Field
                      name="pointAmount"
                      validators={{
                        onChange: ({ value }) => {
                          const amount = Number(value);
                          const channel = form.state.values.pointChannel;
                          const range = isArcaChannel(channel) ? pointRanges?.[channel] : null;
                          if (!value) return t("akasha.points.amountRequired");
                          if (
                            !range ||
                            !Number.isInteger(amount) ||
                            amount < range.min ||
                            amount > range.max
                          ) {
                            return t("akasha.points.amountRange", {
                              min: range?.min ?? "",
                              max: range?.max ?? "",
                            });
                          }
                        },
                      }}
                      children={(f) => (
                        <div className="w-fullitems-center grid gap-2">
                          <Label htmlFor={f.name}>{t("akasha.points.amount")}</Label>
                          <Input
                            id={f.name}
                            inputMode="numeric"
                            value={f.state.value}
                            onValueChange={(value) => f.handleChange(value)}
                            disabled={!pointRanges}
                          />
                          <FieldInfo field={f} />
                        </div>
                      )}
                    />
                  </>
                ) : null
              }
            />
          </>
        )}

        <div className="flex justify-end">
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <button className="size-16" type="submit" disabled={!canSubmit}>
                {isSubmitting ? <Spinner /> : <Random1619 />}
              </button>
            )}
          />
        </div>
      </form>
    </Center>
  );
}
