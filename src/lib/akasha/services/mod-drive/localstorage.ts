interface ModData {
    sig: string;
}

class AkashaModStorage {
    #storageKey;

    constructor(key = "akasha-mod") {
        this.#storageKey = key;
    }

    getAllMods() {
        try {
            const storedData = localStorage.getItem(this.#storageKey);
            return storedData ? JSON.parse(storedData) : {};
        } catch (error) {
            console.error("Error reading from localStorage:", error);
            return {};
        }
    }

    #save(mods: any) {
        try {
            localStorage.setItem(this.#storageKey, JSON.stringify(mods));
        } catch (error) {
            console.error("Error writing to localStorage:", error);
        }
    }

    setMod(modId: string, value: ModData) {
        if (typeof modId !== "string" || !modId) {
            console.error("modId must be a non-empty string.");
            return;
        }
        const allMods = this.getAllMods();
        allMods[modId] = value;
        this.#save(allMods);
    }

    getMod(modId: string): ModData | undefined {
        const allMods = this.getAllMods();
        return allMods[modId];
    }

    removeMod(modId: string) {
        const allMods = this.getAllMods();
        if (modId in allMods) {
            delete allMods[modId];
            this.#save(allMods);
        }
    }

    pushToMod(modId: string, propertyName: string, value: any) {
        const allMods = this.getAllMods();
        const mod = allMods[modId];

        if (!mod) {
            console.error(`Mod with id "${modId}" not found.`);
            return;
        }

        if (!Array.isArray(mod[propertyName])) {
            mod[propertyName] = [];
        }

        mod[propertyName].push(value);
        this.#save(allMods);
    }

    clear() {
        localStorage.removeItem(this.#storageKey);
    }
}

export const modStorage = new AkashaModStorage();
