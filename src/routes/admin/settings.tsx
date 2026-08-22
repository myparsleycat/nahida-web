import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pointSettingsQueryKey, usePointSettings } from "@/lib/akasha/services/point-settings";
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
              유료 판매 가격과 출금 규칙을 변경합니다. 수수료는 22% 이상이어야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {query.data ? (
              <SettingsForm
                key={`${query.data.point_amount_min}-${query.data.point_amount_max}-${query.data.point_withdraw_min}-${query.data.point_withdraw_fee_percent}`}
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
    point_withdraw_fee_percent: number;
  };
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    point_amount_min: String(props.initial.point_amount_min),
    point_amount_max: String(props.initial.point_amount_max),
    point_withdraw_min: String(props.initial.point_withdraw_min),
    point_withdraw_fee_percent: String(props.initial.point_withdraw_fee_percent),
  });

  const save = useMutation({
    mutationFn: async (body: {
      point_amount_min: number;
      point_amount_max: number;
      point_withdraw_min: number;
      point_withdraw_fee_percent: number;
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
    const point_withdraw_fee_percent = Number(draft.point_withdraw_fee_percent);
    if (
      !Number.isInteger(point_amount_min) ||
      !Number.isInteger(point_amount_max) ||
      !Number.isInteger(point_withdraw_min) ||
      !Number.isInteger(point_withdraw_fee_percent)
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
      <Field
        id="point_withdraw_fee_percent"
        label="출금 수수료 (%)"
        value={draft.point_withdraw_fee_percent}
        onValueChange={(value) => setDraft({ ...draft, point_withdraw_fee_percent: value })}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          저장
        </Button>
      </div>
    </form>
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
