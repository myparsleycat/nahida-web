export interface StoreSchema {
    "akasha-mod": {
        sig?: string;
        password?: string;
    };
}

export class NahidaStore<Schema extends Record<string, any>> {
    private db: IDBDatabase | null = null;
    private dbPromise: Promise<IDBDatabase> | null = null;
    private readonly dbName: string;

    constructor(dbName: string = "nahida_store") {
        this.dbName = dbName;
    }

    private getDb(storeName: string): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise.then(() => this.getDb(storeName));
        }

        if (this.db && this.db.objectStoreNames.contains(storeName)) {
            return Promise.resolve(this.db);
        }

        const version = this.db ? this.db.version + 1 : 1;

        if (this.db) {
            this.db.close();
            this.db = null;
        }

        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.dbName, version);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            };

            request.onsuccess = (event: Event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db);
            };

            request.onerror = (event: Event) => {
                console.error("Database error:", (event.target as IDBOpenDBRequest).error);
                reject("Error opening database");
            };
        }).finally(() => {
            this.dbPromise = null;
        });

        return this.dbPromise;
    }

    public async get<S extends keyof Schema>(
        storeName: S,
        key: IDBValidKey,
    ): Promise<Schema[S] | undefined> {
        const db = await this.getDb(storeName as string);
        return new Promise<Schema[S] | undefined>((resolve, reject) => {
            const transaction = db.transaction(storeName as string, "readonly");
            const store = transaction.objectStore(storeName as string);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result as Schema[S] | undefined);
            };

            request.onerror = () => {
                console.error("Get error:", request.error);
                reject(request.error);
            };
        });
    }

    public async set<S extends keyof Schema>(
        storeName: S,
        key: IDBValidKey,
        value: Schema[S],
    ): Promise<void> {
        const db = await this.getDb(storeName as string);
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(storeName as string, "readwrite");
            const store = transaction.objectStore(storeName as string);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error("Set error:", request.error);
                reject(request.error);
            };
        });
    }

    public async del<S extends keyof Schema>(storeName: S, key: IDBValidKey): Promise<void> {
        const db = await this.getDb(storeName as string);
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(storeName as string, "readwrite");
            const store = transaction.objectStore(storeName as string);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error("Delete error:", request.error);
                reject(request.error);
            };
        });
    }

    public async clear<S extends keyof Schema>(storeName: S): Promise<void> {
        const db = await this.getDb(storeName as string);
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(storeName as string, "readwrite");
            const store = transaction.objectStore(storeName as string);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error("Clear error:", request.error);
                reject(request.error);
            };
        });
    }
}

export const store = new NahidaStore<StoreSchema>();
