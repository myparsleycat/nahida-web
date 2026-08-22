import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ArcaChannel } from "@/lib/akasha/services/arca-channel";

import { eden } from "@/lib/eden";
import { copyStr } from "@/lib/utils";

const ID_IS_EMPTY = "아이템 ID를 가져오는데 실패함";

export function usePubLinkQuery(itemId: string | undefined) {
    return useQuery({
        queryKey: ["akasha", "drive", "publink", itemId],
        queryFn: async () => {
            if (!itemId) {
                throw new Error(ID_IS_EMPTY);
            }

            const { data, error } = await eden.akasha.content.share({ id: itemId }).get();

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        },
        enabled: !!itemId,
    });
}

export function usePubLinkMutations(
    query: ReturnType<typeof usePubLinkQuery>,
    itemId: string | undefined,
) {
    const { t } = useTranslation();

    const changePermissionMutation = useMutation({
        mutationKey: ["akasha", "drive", "pub-link-dialog", "permission", "change"],
        mutationFn: async (pid: string) => {
            if (!query.data?.id) {
                throw new Error(ID_IS_EMPTY);
            }

            const { data, error } = await eden.akasha.content.share
                .permission({ id: query.data.id })
                .p({ pid })
                .patch();

            if (error) {
                throw new Error(error.value.toString());
            }

            return data.r;
        },
    });

    const handleChangePermission = async (pid: string) => {
        return changePermissionMutation
            .mutateAsync(pid)
            .then(() => {
                toast.success(t("#.PubLinkDialog.permissionChanged"));
                void query.refetch();
            })
            .catch((err) => {
                toast.error(t("#.PubLinkDialog.permissionChangeError"), {
                    description: err.message,
                });
            });
    };

    const deletePermissionMutation = useMutation({
        mutationKey: ["akasha", "drive", "pub-link-dialog", "permission", "delete"],
        mutationFn: async (pid: string) => {
            if (!query.data?.id) {
                throw new Error(ID_IS_EMPTY);
            }

            const { error } = await eden.akasha.content.share
                .permission({ id: query.data.id })
                .p({ pid })
                .delete();

            if (error) {
                throw new Error(error.value.toString());
            }

            return true;
        },
    });

    const handleDeletePermission = async (pid: string) => {
        return deletePermissionMutation
            .mutateAsync(pid)
            .then(() => {
                toast.success(t("#.PubLinkDialog.permissionDeleted"));
                void query.refetch();
            })
            .catch((err) => {
                toast.error(t("#.PubLinkDialog.permissionDeleteError"), {
                    description: err.message,
                });
            });
    };

    const handleCopyInviteUrl = async () => {
        if (!query.data?.id) {
            toast.error(ID_IS_EMPTY);
            return;
        }

        const { data, error } = await eden.akasha.content.share
            .permission({ id: query.data.id })
            .invite_url.get();

        if (error) {
            return toast.warning(t("#.PubLinkDialog.inviteUrlError"), {
                description: error.value.toString(),
            });
        }

        copyStr(data.url);
    };

    const pwdMutation = useMutation({
        mutationKey: ["akasha", "drive", "pub-link-dialog", "link", "password"],
        mutationFn: async ({
            id,
            bool,
            password,
        }: {
            id: string;
            bool: boolean;
            password: string;
        }) => {
            const { data, error } = await eden.akasha.content.share.link({ id }).password.patch({
                value: bool ? null : password,
            });

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        },
    });

    const handlePasswordSubmit = async (e: React.FormEvent, hasPassword: boolean) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const password = formData.get("password")?.toString() ?? "";

        if (!query.data?.link) {
            return toast.warning(ID_IS_EMPTY);
        }

        await pwdMutation.mutateAsync({
            id: query.data.link.id,
            bool: hasPassword,
            password,
        });

        toast.success(
            hasPassword
                ? t("#.PubLinkDialog.passwordRemoved")
                : t("#.PubLinkDialog.passwordCreated"),
        );

        await query.refetch();
    };

    const linkExpiresPatchMutation = useMutation({
        mutationKey: ["akasha", "drive", "pub-link-dialog", "link", "expires"],
        mutationFn: async ({ id, value }: { id: string; value: string | undefined }) => {
            const { data, error } = await eden.akasha.content.share.link({ id }).expires.patch({
                value: value || null,
            });

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        },
    });

    const handleDatePickerSave = async (selectedDate: Date | undefined) => {
        if (!query.data?.id) {
            return toast.warning(ID_IS_EMPTY);
        }

        let value: string = "";
        if (selectedDate) {
            value = format(selectedDate, "yyyy-MM-dd");
        }

        await linkExpiresPatchMutation.mutateAsync({
            id: query.data.link?.id ?? "",
            value,
        });

        toast.success(value ? t("#.PubLinkDialog.expirySet") : t("#.PubLinkDialog.expiryUnset"));

        await query.refetch();
    };

    const pointsMutation = useMutation({
        mutationKey: ["akasha", "drive", "pub-link-dialog", "link", "points"],
        mutationFn: async ({
            id,
            amount,
            channel,
        }: {
            id: string;
            amount: number | null;
            channel?: ArcaChannel;
        }) => {
            const { data, error } = await eden.akasha.content.share.link({ id }).points.patch({
                amount,
                ...(channel ? { channel } : {}),
            });

            if (error) {
                throw new Error(error.value.toString());
            }

            return data;
        },
    });

    const handlePointsSave = async (payload: { amount: number | null; channel?: ArcaChannel }) => {
        if (!query.data?.link) {
            toast.warning(ID_IS_EMPTY);
            return;
        }

        await pointsMutation.mutateAsync({
            id: query.data.link.id,
            amount: payload.amount,
            channel: payload.channel,
        });

        toast.success(
            payload.amount == null
                ? t("#.PubLinkDialog.pointsRemoved")
                : t("#.PubLinkDialog.pointsSaved"),
        );

        await query.refetch();
    };

    const handlePubLinkToggle = async (
        setPubLinkSwitch: (value: boolean) => void,
        currentValue: boolean,
    ) => {
        if (!itemId) {
            setPubLinkSwitch(!currentValue);
            return toast.error(ID_IS_EMPTY);
        }

        if (!query.data?.link) {
            const { error } = await eden.akasha.content.share.link.post(null, {
                query: { item_id: itemId },
            });

            if (error) {
                setPubLinkSwitch(false);
                return toast.error(error.value.toString());
            }
        } else {
            const { error } = await eden.akasha.content.share
                .link({ id: query.data?.link?.id ?? "" })
                .delete();

            if (error) {
                setPubLinkSwitch(true);
                return toast.warning(error.value.toString());
            }
        }

        toast.success(
            !query.data?.link ? t("#.PubLinkDialog.linkCreated") : t("#.PubLinkDialog.linkRemoved"),
        );

        await query.refetch();
    };

    const handleCopyLink = () => {
        const str = query.data?.link?.url;

        if (!str) {
            toast.warning("Cannot found Link URL");
            return;
        }

        copyStr(str);
    };

    return {
        handleChangePermission,
        handleDeletePermission,
        handleCopyInviteUrl,
        handlePasswordSubmit,
        handleDatePickerSave,
        handlePointsSave,
        handlePubLinkToggle,
        handleCopyLink,
    };
}
