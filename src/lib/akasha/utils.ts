import { t } from "i18next";

export const ValidateName = (name: string) => {
    if (!name.trim()) {
        return t("#.ValidateName.0");
    } else if (name[0] === " ") {
        return t("#.ValidateName.1");
    } else if (name[name.length - 1] === " ") {
        return t("#.ValidateName.2");
    } else if (name.length <= 0 || name.length > 255) {
        return t("#.ValidateName.3");
    }

    return null;
};
