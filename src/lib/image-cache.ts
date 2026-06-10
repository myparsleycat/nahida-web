import ky from "ky";

function openDB(dbName: string, storeName: string) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

function saveToIndexedDB(db: IDBDatabase, storeName: string, key: string, value: string | Blob) {
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function loadFromIndexedDB(
    db: IDBDatabase,
    storeName: string,
    key: string,
): Promise<string | Blob | null> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export class PreviewCache {
    private dbName: string = "preview_cache";
    private storeName: string = "previews";
    private static blobUrlCache: Map<string, string> = new Map();

    public async getPreview(url: string): Promise<string> {
        const db = await openDB(this.dbName, this.storeName);
        const pathname = new URL(url).pathname;
        const match = pathname.match(
            /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
        );
        if (!match) {
            throw new Error(`Invalid URL format, no UUID found: ${url}`);
        }
        const key = match[1];

        if (PreviewCache.blobUrlCache.has(key)) {
            return PreviewCache.blobUrlCache.get(key)!;
        }

        const cachedBlob = (await loadFromIndexedDB(db, this.storeName, key)) as Blob | null;
        if (cachedBlob) {
            const blobUrl = URL.createObjectURL(cachedBlob);
            PreviewCache.blobUrlCache.set(key, blobUrl);
            return blobUrl;
        } else {
            const resp = await ky.get(url, { throwHttpErrors: false });
            if (resp.ok) {
                const blob = await resp.blob();
                await saveToIndexedDB(db, this.storeName, key, blob);
                const blobUrl = URL.createObjectURL(blob);
                PreviewCache.blobUrlCache.set(key, blobUrl);
                return blobUrl;
            } else {
                return url;
            }
        }
    }

    public revokeBlobUrl(key: string): void {
        const blobUrl = PreviewCache.blobUrlCache.get(key);
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            PreviewCache.blobUrlCache.delete(key);
        }
    }

    public revokeAllBlobUrl(): void {
        for (const blobUrl of PreviewCache.blobUrlCache.values()) {
            URL.revokeObjectURL(blobUrl);
        }
        PreviewCache.blobUrlCache.clear();
    }

    public async clearCache(): Promise<void> {
        const db = await openDB(this.dbName, this.storeName);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => {
                this.revokeAllBlobUrl();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async getCachedSize(): Promise<number> {
        const db = await openDB(this.dbName, this.storeName);
        return new Promise<number>((resolve, reject) => {
            let totalSize = 0;
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const value = cursor.value;
                    if (value instanceof Blob) {
                        totalSize += value.size;
                    }
                    cursor.continue();
                } else {
                    resolve(totalSize);
                }
            };
        });
    }
}

export const previewCache = new PreviewCache();
