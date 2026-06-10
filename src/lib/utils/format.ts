import { format } from "date-fns";
import { ko, enUS, zhCN } from "date-fns/locale";
import { isNil } from "es-toolkit";
import { filesize, type FilesizeOptions } from "filesize";

export function formatSize(size?: number | null, options?: FilesizeOptions) {
    if (isNil(size)) return "0 B";
    return filesize(size, { standard: "jedec", ...options });
}

export const formatDate = (
    date: Date | string,
    lang?: string | undefined | null,
    formatStr?: string,
) => {
    return format(date, formatStr || "PPpp", {
        locale: (() => {
            if (lang?.startsWith("ko")) return ko;
            else if (lang?.startsWith("zh")) return zhCN;
            return enUS;
        })(),
    });
};
