import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARCA_CHANNEL_IDS, type ArcaChannel } from "@/lib/akasha/services/arca-channel";
import { pointSettingsQueryKey, usePointSettings } from "@/lib/akasha/services/point-settings";
import {
  effectiveWithdrawFeePercent,
  POINT_WITHDRAW_FEE_BASE_PERCENT,
} from "@/lib/akasha/services/point-withdraw";
import { eden } from "@/lib/eden";

export const Route = createFileRoute("/admin/settings")({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: "포인트 설정 | 나히다 라이브" }],
  }),
});

function RouteComponent() {
  const query = usePointSettings();

  return (
    <div className="flex justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 py-20">
        <Card>
          <CardHeader>
            <CardTitle>포인트 설정</CardTitle>
            <CardDescription>
              유료 판매 가격과 출금 규칙을 변경합니다. 기본 {POINT_WITHDRAW_FEE_BASE_PERCENT}%는
              모든 채널에 동일하게 적용하고, 추가 수수료만 채널마다 따로 둡니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {query.data ? (
              <SettingsForm
                key={`${query.data.point_amount_min}-${query.data.point_amount_max}-${query.data.point_withdraw_min}-${ARCA_CHANNEL_IDS.map((id) => query.data.point_withdraw_fee_percent[id]).join("-")}`}
                initial={query.data}
              />
            ) : (
              <p className="text-muted-foreground">설정을 불러오는 중...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsForm(props: {
  initial: {
    point_amount_min: number;
    point_amount_max: number;
    point_withdraw_min: number;
    point_withdraw_fee_percent: Record<ArcaChannel, number>;
  };
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    point_amount_min: String(props.initial.point_amount_min),
    point_amount_max: String(props.initial.point_amount_max),
    point_withdraw_min: String(props.initial.point_withdraw_min),
    point_withdraw_fee_percent: Object.fromEntries(
      ARCA_CHANNEL_IDS.map((id) => [id, String(props.initial.point_withdraw_fee_percent[id])]),
    ) as Record<ArcaChannel, string>,
  });

  const save = useMutation({
    mutationFn: async (body: {
      point_amount_min: number;
      point_amount_max: number;
      point_withdraw_min: number;
      point_withdraw_fee_percent: Record<ArcaChannel, number>;
    }) => {
      const { data, error } = await eden.admin.settings.patch(body);
      if (error) {
        throw new Error(
          typeof error.value === "string" ? error.value : "설정을 저장하지 못했습니다",
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pointSettingsQueryKey });
      toast.success("설정을 저장했습니다");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "설정을 저장하지 못했습니다");
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const point_amount_min = Number(draft.point_amount_min);
    const point_amount_max = Number(draft.point_amount_max);
    const point_withdraw_min = Number(draft.point_withdraw_min);
    const point_withdraw_fee_percent = Object.fromEntries(
      ARCA_CHANNEL_IDS.map((id) => [id, Number(draft.point_withdraw_fee_percent[id])]),
    ) as Record<ArcaChannel, number>;
    if (
      !Number.isInteger(point_amount_min) ||
      !Number.isInteger(point_amount_max) ||
      !Number.isInteger(point_withdraw_min) ||
      ARCA_CHANNEL_IDS.some((id) => !Number.isInteger(point_withdraw_fee_percent[id]))
    ) {
      toast.warning("모든 값은 정수여야 합니다");
      return;
    }
    save.mutate({
      point_amount_min,
      point_amount_max,
      point_withdraw_min,
      point_withdraw_fee_percent,
    });
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field
        id="point_amount_min"
        label="유료 판매 최소 포인트"
        value={draft.point_amount_min}
        onValueChange={(value) => setDraft({ ...draft, point_amount_min: value })}
      />
      <Field
        id="point_amount_max"
        label="유료 판매 최대 포인트"
        value={draft.point_amount_max}
        onValueChange={(value) => setDraft({ ...draft, point_amount_max: value })}
      />
      <Field
        id="point_withdraw_min"
        label="최소 출금 포인트"
        value={draft.point_withdraw_min}
        onValueChange={(value) => setDraft({ ...draft, point_withdraw_min: value })}
      />
      {ARCA_CHANNEL_IDS.map((channel) => (
        <WithdrawFeeField
          key={channel}
          channel={channel}
          value={draft.point_withdraw_fee_percent[channel]}
          onValueChange={(value) =>
            setDraft({
              ...draft,
              point_withdraw_fee_percent: {
                ...draft.point_withdraw_fee_percent,
                [channel]: value,
              },
            })
          }
        />
      ))}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          저장
        </Button>
      </div>
    </form>
  );
}

function WithdrawFeeField(props: {
  channel: ArcaChannel;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const surcharge = Number(props.value);
  const applied =
    props.value.trim() !== "" && Number.isInteger(surcharge) && surcharge >= 0
      ? effectiveWithdrawFeePercent(surcharge)
      : null;

  return (
    <div className="grid gap-2">
      <Label htmlFor={`point_withdraw_fee_percent_${props.channel}`}>
        출금 수수료 ({props.channel}) (%)
      </Label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Input
          disabled
          readOnly
          value={String(POINT_WITHDRAW_FEE_BASE_PERCENT)}
          aria-label={`${props.channel} 기본 출금 수수료`}
        />
        <span className="text-muted-foreground" aria-hidden>
          +
        </span>
        <Input
          id={`point_withdraw_fee_percent_${props.channel}`}
          inputMode="numeric"
          value={props.value}
          onValueChange={props.onValueChange}
        />
      </div>
      {applied != null ? <p className="text-muted-foreground">적용 {applied}%</p> : null}
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        inputMode="numeric"
        value={props.value}
        onValueChange={props.onValueChange}
      />
    </div>
  );
}
