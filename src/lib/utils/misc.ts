import copy from "copy-to-clipboard";
import { t } from "i18next";
import { toast } from "sonner";

import type { Content, SortType } from "@/lib/akasha/types";

import { naturalCompare } from "./str-filter";

export const getRandInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getRandFloat = (min: number, max: number): number => {
    return Math.random() * (max - min) + min;
};

export function copyStr(str: string) {
    copy(str);
    toast.success(t("drive.toast.copied_to_clipboard"));
}

export const getImageFromClipboard = async (): Promise<File | null> => {
    try {
        const clipboardItems = await navigator.clipboard.read();

        for (const clipboardItem of clipboardItems) {
            const imageTypes = clipboardItem.types.filter((type) => type.startsWith("image/"));

            if (imageTypes.length > 0) {
                const blob = await clipboardItem.getType(imageTypes[0]);
                return new File([blob], `clipboard-image.${imageTypes[0].split("/")[1]}`, {
                    type: imageTypes[0],
                });
            }
        }

        return null;
    } catch (err) {
        console.error("클립보드에서 이미지를 가져오는 중 오류 발생:", err);
        throw err;
    }
};

class base64urlClass {
    public encode(str: string): string {
        const encodedStr = encodeURIComponent(str).replace(
            /%([0-9A-F]{2})/g,
            function toLatin1(match, p1) {
                return String.fromCharCode(parseInt(p1, 16));
            },
        );
        return btoa(encodedStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    public decode(str: string): string {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) {
            str += "=";
        }
        const decodedStr = atob(str);
        return decodeURIComponent(
            decodedStr
                .split("")
                .map(function (c) {
                    return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join(""),
        );
    }
}
export const base64url = new base64urlClass();

export function commonSort(content: Content[], sortType: SortType) {
    return [...content].sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;

        const [field, order] = sortType.split(":");
        const multiplier = order === "DESC" ? -1 : 1;

        switch (field) {
            case "NAME":
                return naturalCompare(a.name, b.name, multiplier);
            case "SIZE":
                const sizeA = Number(a.size) || 0;
                const sizeB = Number(b.size) || 0;
                return multiplier * (sizeA - sizeB);
            case "DATE":
                const dateA = new Date(a.updatedAt).getTime();
                const dateB = new Date(b.updatedAt).getTime();
                return multiplier * (dateA - dateB);
            default:
                return 0;
        }
    });
}
