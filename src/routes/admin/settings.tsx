import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARCA_CHANNEL_IDS, type ArcaChannel } from "@/lib/akasha/services/arca-channel";
import {
    pointSettingsQueryKey,
    type PointSettingsData,
    usePointSettings,
} from "@/lib/akasha/services/point-settings";
import {
    effectiveWithdrawFeePercent,
    POINT_WITHDRAW_FEE_BASE_PERCENT,
} from "@/lib/akasha/services/point-withdraw";
import { eden } from "@/lib/eden";

type ChannelDraft = {
    point_amount_min: string;
    point_amount_max: string;
    point_withdraw_min: string;
    point_withdraw_fee_percent: string;
};

type Draft = Record<ArcaChannel, ChannelDraft>;

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
                            유료 판매 가격과 출금 규칙을 변경합니다. 모든 필드를 채널별로 설정합니다.
                            기본 {POINT_WITHDRAW_FEE_BASE_PERCENT}%는 모든 채널에 동일하게 적용하고,
                            추가 수수료만 채널마다 따로 둡니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {query.data ? (
                            <SettingsForm key={draftKey(query.data)} initial={query.data} />
                        ) : (
                            <p className="text-muted-foreground">설정을 불러오는 중...</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function draftKey(data: PointSettingsData): string {
    return ARCA_CHANNEL_IDS.map(
        (id) =>
            `${id}:${data.point_amount_min[id]}-${data.point_amount_max[id]}-${data.point_withdraw_min[id]}-${data.point_withdraw_fee_percent[id]}`,
    ).join("|");
}

function SettingsForm(props: { initial: PointSettingsData }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<Draft>(() => toDraft(props.initial));

    const save = useMutation({
        mutationFn: async (body: PointSettingsData) => {
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
        const body = fromDraft(draft);
        if (
            ARCA_CHANNEL_IDS.some(
                (id) =>
                    !Number.isInteger(body.point_amount_min[id]) ||
                    !Number.isInteger(body.point_amount_max[id]) ||
                    !Number.isInteger(body.point_withdraw_min[id]) ||
                    !Number.isInteger(body.point_withdraw_fee_percent[id]),
            )
        ) {
            toast.warning("모든 값은 정수여야 합니다");
            return;
        }
        save.mutate(body);
    };

    return (
        <form className="grid gap-6" onSubmit={handleSubmit}>
            {ARCA_CHANNEL_IDS.map((channel) => (
                <ChannelSection
                    key={channel}
                    channel={channel}
                    draft={draft[channel]}
                    onChange={(next) => setDraft((prev) => ({ ...prev, [channel]: next }))}
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

function ChannelSection(props: {
    channel: ArcaChannel;
    draft: ChannelDraft;
    onChange: (next: ChannelDraft) => void;
}) {
    return (
        <div className="grid gap-4 rounded-lg border p-4">
            <p className="font-medium">{props.channel}</p>

            <div className="grid grid-cols-3 gap-3">
                <CompactField
                    id={`point_amount_min_${props.channel}`}
                    label="최소 포인트"
                    value={props.draft.point_amount_min}
                    onValueChange={(v) => props.onChange({ ...props.draft, point_amount_min: v })}
                />
                <CompactField
                    id={`point_amount_max_${props.channel}`}
                    label="최대 포인트"
                    value={props.draft.point_amount_max}
                    onValueChange={(v) => props.onChange({ ...props.draft, point_amount_max: v })}
                />
                <CompactField
                    id={`point_withdraw_min_${props.channel}`}
                    label="최소 출금"
                    value={props.draft.point_withdraw_min}
                    onValueChange={(v) =>
                        props.onChange({ ...props.draft, point_withdraw_min: v })
                    }
                />
            </div>

            <WithdrawFeeField
                channel={props.channel}
                value={props.draft.point_withdraw_fee_percent}
                onValueChange={(v) =>
                    props.onChange({ ...props.draft, point_withdraw_fee_percent: v })
                }
            />
        </div>
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
            <Label htmlFor={`point_withdraw_fee_percent_${props.channel}`}>출금 수수료 (%)</Label>
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

function CompactField(props: {
    id: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={props.id} className="text-xs text-muted-foreground">
                {props.label}
            </Label>
            <Input
                id={props.id}
                inputMode="numeric"
                value={props.value}
                onValueChange={props.onValueChange}
            />
        </div>
    );
}

function channelNumberMap(
    draft: Draft,
    pick: (d: ChannelDraft) => number,
): Record<ArcaChannel, number> {
    return Object.fromEntries(
        ARCA_CHANNEL_IDS.map((id) => [id, pick(draft[id])]),
    ) as Record<ArcaChannel, number>;
}

function toDraft(initial: PointSettingsData): Draft {
    return Object.fromEntries(
        ARCA_CHANNEL_IDS.map((id) => [
            id,
            {
                point_amount_min: String(initial.point_amount_min[id]),
                point_amount_max: String(initial.point_amount_max[id]),
                point_withdraw_min: String(initial.point_withdraw_min[id]),
                point_withdraw_fee_percent: String(initial.point_withdraw_fee_percent[id]),
            },
        ]),
    ) as Draft;
}

function fromDraft(draft: Draft): PointSettingsData {
    return {
        point_amount_min: channelNumberMap(draft, (d) => Number(d.point_amount_min)),
        point_amount_max: channelNumberMap(draft, (d) => Number(d.point_amount_max)),
        point_withdraw_min: channelNumberMap(draft, (d) => Number(d.point_withdraw_min)),
        point_withdraw_fee_percent: channelNumberMap(draft, (d) =>
            Number(d.point_withdraw_fee_percent),
        ),
    };
}