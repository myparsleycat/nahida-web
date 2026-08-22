import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ArcaLink } from "@/components/page/ArcaLink";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ARCA_CHANNEL_IDS, type ArcaChannel } from "@/lib/akasha/services/arca-channel";
import { usePointSettings } from "@/lib/akasha/services/point-settings";
import {
  effectiveWithdrawFeePercent,
  parseWithdrawAmountInput,
  quoteWithdrawal,
} from "@/lib/akasha/services/point-withdraw";
import { authClient, useSession } from "@/lib/auth-client";
import { eden } from "@/lib/eden";

export const Route = createFileRoute("/u/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const session = useSession().data;
  const navi = useNavigate();

  const [delaccinput, setDelAccInput] = useState("");
  const [withdrawInputs, setWithdrawInputs] = useState<Record<ArcaChannel, string>>({
    genshinskinmode: "",
    thingzyoa: "",
  });
  const pointSettings = usePointSettings();
  const withdrawMin = pointSettings.data?.point_withdraw_min;
  const feePercents = pointSettings.data?.point_withdraw_fee_percent;

  const query = useQuery({
    queryKey: ["u:mods-count"],
    queryFn: async () => {
      const { data, error } = await eden.hello.mymods.count.get();

      if (error) {
        throw new Error(error.value.toString());
      }

      return data.count;
    },
    retry: false,
    placeholderData: (prev) => prev,
  });

  const balanceQuery = useQuery({
    queryKey: ["u:points-balance"],
    queryFn: async () => {
      const { data, error } = await eden.akasha.points.balance.get();

      if (error) {
        throw new Error(error.value.toString());
      }

      return data.balances;
    },
    retry: false,
    placeholderData: (prev) => prev,
  });

  const arcaQuery = useQuery({
    queryKey: ["u:arca-link"],
    queryFn: async () => {
      const { data, error } = await eden.arca.link.get();
      if (error) throw error;
      return data;
    },
  });

  const balances = balanceQuery.data ?? { genshinskinmode: 0, thingzyoa: 0 };
  const linkedUsername = arcaQuery.data?.arcaUsername ?? null;

  return (
    <>
      <div className="h-18"></div>
      <div className="z-0 mx-auto flex w-full flex-1 flex-col overflow-auto px-0 py-4 sm:overflow-visible">
        <div className="mx-auto flex flex-col items-center gap-6 p-4">
          <div className="flex w-lg flex-col gap-6 rounded-lg border p-4">
            <h2 className="text-2xl font-bold">{t("g.mods")}</h2>

            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("u.my_mods")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>{query.data ?? 0}개의 업로드된 모드</span>
                </p>
              </div>
              <div className="justify-items-end">
                <Button asChild>
                  <Link to="/u/mods">{t("g.continue")}</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex w-lg flex-col gap-6 rounded-lg border p-4">
            <h2 className="text-2xl font-bold">{t("u.points_balance")}</h2>

            <p className="text-sm text-muted-foreground">{t("u.points_balance_description")}</p>

            {ARCA_CHANNEL_IDS.map((channel) => (
              <div key={channel} className="flex items-center gap-4 sm:gap-16">
                <div className="flex-1">
                  <Label>{t(`u.arca_channels.${channel}`)}</Label>
                </div>
                <div className="justify-items-end">
                  <p>{balances[channel] ?? 0}</p>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("u.points_withdraw")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>
                    {linkedUsername
                      ? t("u.points_withdraw_description", {
                          username: linkedUsername,
                          min: withdrawMin ?? "",
                        })
                      : t("u.points_withdraw_need_arca")}
                  </span>
                </p>
              </div>
            </div>

            {linkedUsername
              ? ARCA_CHANNEL_IDS.map((channel) => (
                  <ChannelWithdraw
                    key={channel}
                    channel={channel}
                    balance={balances[channel] ?? 0}
                    input={withdrawInputs[channel]}
                    onInputChange={(value) =>
                      setWithdrawInputs((current) => ({ ...current, [channel]: value }))
                    }
                    withdrawMin={withdrawMin}
                    feePercent={feePercents?.[channel]}
                    username={linkedUsername}
                    onDone={async () => {
                      setWithdrawInputs((current) => ({ ...current, [channel]: "" }));
                      await balanceQuery.refetch();
                    }}
                  />
                ))
              : null}
          </div>

          <div className="flex w-lg flex-col gap-6 rounded-lg border p-4">
            <h2 className="text-2xl font-bold">{t("g.account")}</h2>

            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("g.name")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>Your display name can be edited</span>
                </p>
              </div>
              <div className="w-32 justify-items-end md:w-48">
                <Input disabled defaultValue={session?.user.name} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-4 sm:gap-16">
              <div className="flex-1">
                <Label>{t("u.delete_account")}</Label>
                <p className="text-sm text-muted-foreground">
                  <span>계정을 삭제합니다</span>
                </p>
              </div>
              <div className="justify-items-end">
                <AlertDialog>
                  <AlertDialogTrigger className={buttonVariants({ variant: "destructive" })}>
                    {t("g.delete")}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>정말로 계정을 삭제할까요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        삭제 버튼을 누르는 즉시 계정 데이터가 영구적으로 삭제됩니다. 이 작업은
                        되돌릴 수 없습니다! {t("u.points_delete_blocked")}
                      </AlertDialogDescription>

                      <Accordion type="single">
                        <AccordionItem value="item-1">
                          <AccordionTrigger>제거되는 데이터</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              <p>- 사용자 이름, 아이디, 이메일, 비밀번호를 포함한 전체 유저 정보</p>
                              <p>- 로그인 세션</p>
                              <p>
                                - 나히다 드라이브의 전체 데이터 (공유 링크와 공유 드라이브 포함)
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                          <AccordionTrigger>제거되지 않는 데이터</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              <p>- 업로드한 모드 (나히다 드라이브 공유 제외)</p>
                              <p>- 모드 다운로드 기록</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      <div className="mt-6 space-y-1">
                        <Label className="text-xs">
                          계정을 삭제하려면 아래에 '삭제'를 입력하고 삭제 버튼을 클릭하세요
                        </Label>
                        <Input placeholder="삭제" onValueChange={setDelAccInput} />
                      </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className={buttonVariants({ variant: "destructive" })}
                        disabled={delaccinput !== "삭제"}
                        onClick={async () => {
                          try {
                            const res = await authClient.deleteUser();
                            if (res.data?.success) {
                              toast.success("계정이 삭제되었습니다");
                              await navi({ to: "/" }).catch((error: unknown) => {
                                console.error("Failed to navigate after account deletion:", error);
                              });
                              return;
                            }

                            if (res.error?.message === "point_balance_remaining") {
                              toast.error(t("u.points_delete_blocked"));
                              return;
                            }

                            if (res.error?.message) {
                              toast.error(res.error.message);
                            }
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >
                        {t("g.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          <div className="flex w-lg flex-col gap-6 rounded-lg border p-4">
            <h2 className="text-2xl font-bold">{t("u.arca")}</h2>
            <ArcaLink />
          </div>
        </div>
      </div>
    </>
  );
}

function ChannelWithdraw(props: {
  channel: ArcaChannel;
  balance: number;
  input: string;
  onInputChange: (value: string) => void;
  withdrawMin: number | undefined;
  feePercent: number | undefined;
  username: string;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const amount = parseWithdrawAmountInput(props.input);
  const quote =
    amount != null && props.feePercent != null
      ? quoteWithdrawal(amount, effectiveWithdrawFeePercent(props.feePercent))
      : null;
  const tooSmall = amount != null && props.withdrawMin != null && amount < props.withdrawMin;
  const tooLarge = amount != null && amount > props.balance;
  const canWithdraw =
    amount != null &&
    props.withdrawMin != null &&
    props.feePercent != null &&
    !tooSmall &&
    !tooLarge;

  return (
    <div className="flex items-center gap-4 sm:gap-16">
      <div className="flex-1">
        <Label>{t(`u.arca_channels.${props.channel}`)}</Label>
        <Input
          inputMode="numeric"
          placeholder={t("u.points_withdraw_amount")}
          value={props.input}
          onValueChange={props.onInputChange}
          disabled={props.withdrawMin == null}
        />
        {tooSmall ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("u.points_withdraw_min", { min: props.withdrawMin })}
          </p>
        ) : tooLarge ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("u.points_withdraw_insufficient")}
          </p>
        ) : quote ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("u.points_withdraw_quote", {
              fee: quote.fee,
              payout: quote.payout,
            })}
          </p>
        ) : null}
      </div>
      <div className="justify-items-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canWithdraw}>{t("u.points_withdraw")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("u.points_withdraw_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("u.points_withdraw_confirm_description", {
                  amount: amount ?? 0,
                  fee: quote?.fee ?? 0,
                  payout: quote?.payout ?? 0,
                  username: props.username,
                  channel: t(`u.arca_channels.${props.channel}`),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (amount == null) return;
                  const { data, error } = await eden.akasha.points.withdraw.post({
                    amount,
                    channel: props.channel,
                  });
                  if (error) {
                    toast.error(
                      t([
                        `u.points_withdraw_errors.${withdrawErrorCode(error.value)}`,
                        "u.points_withdraw_errors.unknown",
                      ]),
                    );
                    return;
                  }
                  if (!isWithdrawResult(data)) {
                    toast.error(t("u.points_withdraw_errors.unknown"));
                    return;
                  }
                  toast.success(
                    t("u.points_withdraw_done", {
                      payout: data.payout,
                      username: data.arcaUsername,
                      channel: t(`u.arca_channels.${props.channel}`),
                    }),
                  );
                  await props.onDone();
                }}
              >
                {t("u.points_withdraw")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function withdrawErrorCode(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "error" in value) {
    return String((value as { error: unknown }).error);
  }
  return "unknown";
}

function isWithdrawResult(data: unknown): data is { payout: number; arcaUsername: string } {
  return (
    !!data &&
    typeof data === "object" &&
    "payout" in data &&
    "arcaUsername" in data &&
    !("error" in data)
  );
}
