export class TypedStorage {
    static set<T>(key: string, value: T): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error("Storage set error:", error);
        }
    }

    static get<T>(key: string, defaultValue?: T): T | null {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : (defaultValue ?? null);
        } catch (error) {
            console.error("Storage get error:", error);
            return defaultValue ?? null;
        }
    }

    static remove(key: string): void {
        localStorage.removeItem(key);
    }

    static clear(): void {
        localStorage.clear();
    }
}
