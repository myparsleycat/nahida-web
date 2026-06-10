import { TypedStorage } from "@/lib/utils";

interface AkashaSettingsData {
    sheet_open: boolean;
    layout: "list" | "grid";
}

class AkashaSettingClass {
    private static readonly KEY = "akasha_settings";
    private static readonly DEFAULTS: AkashaSettingsData = {
        sheet_open: true,
        layout: "list",
    };

    constructor() {
        this.init();
    }

    private init(): void {
        const existing = TypedStorage.get<Partial<AkashaSettingsData>>(AkashaSettingClass.KEY);
        if (!existing) {
            TypedStorage.set<AkashaSettingsData>(
                AkashaSettingClass.KEY,
                AkashaSettingClass.DEFAULTS,
            );
        } else {
            const mergedData = { ...AkashaSettingClass.DEFAULTS, ...existing };
            TypedStorage.set<AkashaSettingsData>(AkashaSettingClass.KEY, mergedData);
        }
    }

    private getData(): AkashaSettingsData {
        const stored = TypedStorage.get<Partial<AkashaSettingsData>>(AkashaSettingClass.KEY);
        return { ...AkashaSettingClass.DEFAULTS, ...stored };
    }

    private setData(data: AkashaSettingsData): void {
        TypedStorage.set<AkashaSettingsData>(AkashaSettingClass.KEY, data);
    }

    get<K extends keyof AkashaSettingsData>(key: K): AkashaSettingsData[K] {
        return this.getData()[key];
    }

    set<K extends keyof AkashaSettingsData>(key: K, value: AkashaSettingsData[K]): void {
        const data = this.getData();
        data[key] = value;
        this.setData(data);
    }

    getAll(): Readonly<AkashaSettingsData> {
        return this.getData();
    }

    update(partial: Partial<AkashaSettingsData>): void {
        const data = this.getData();
        Object.assign(data, partial);
        this.setData(data);
    }

    reset(): void {
        this.setData(AkashaSettingClass.DEFAULTS);
    }
}

function createAkashaSettings() {
    const instance = new AkashaSettingClass();

    return new Proxy(instance, {
        get(target, prop: string | symbol) {
            if (prop in target || typeof prop === "symbol") {
                return (target as any)[prop];
            }

            if (typeof prop === "string" && prop in AkashaSettingClass["DEFAULTS"]) {
                return target.get(prop as keyof AkashaSettingsData);
            }

            return undefined;
        },

        set(target, prop: string | symbol, value) {
            if (prop in target || typeof prop === "symbol") {
                (target as any)[prop] = value;
                return true;
            }

            if (typeof prop === "string" && prop in AkashaSettingClass["DEFAULTS"]) {
                target.set(prop as keyof AkashaSettingsData, value);
                return true;
            }

            return false;
        },
    }) as AkashaSettingClass & AkashaSettingsData;
}

export const setting = createAkashaSettings();
