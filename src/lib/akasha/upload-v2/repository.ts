import type {
    PersistedUploadIntent,
    PersistedUploadSession,
    PersistedUploadTarget,
    UploadSessionSnapshot,
} from "./types";

const DATABASE_NAME = "akasha_uploads_v1";
const DATABASE_VERSION = 1;
const SESSION_STORE = "sessions";
const TARGET_STORE = "targets";
const INTENT_STORE = "intents";
const REQUEST_ID_INDEX = "requestId";

let databasePromise: Promise<IDBDatabase> | undefined;

export async function saveUploadSession(session: PersistedUploadSession) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const store = transaction.objectStore(SESSION_STORE);
    const existing = await requestResult<PersistedUploadSession | undefined>(
        store.get(session.requestId),
    );
    store.put({
        ...session,
        leaseOwner: existing?.leaseOwner,
        leaseUntil: existing?.leaseUntil,
    });
    await transactionDone(transaction);
}

export async function saveUploadTarget(target: PersistedUploadTarget) {
    await putRecord(TARGET_STORE, target);
}

export async function saveUploadTargets(targets: PersistedUploadTarget[]) {
    await putRecords(TARGET_STORE, targets);
}

export async function saveUploadIntent(intent: PersistedUploadIntent) {
    await putRecord(INTENT_STORE, intent);
}

export async function saveUploadIntents(intents: PersistedUploadIntent[]) {
    await putRecords(INTENT_STORE, intents);
}

export async function getUploadSession(requestId: string) {
    return getRecord<PersistedUploadSession>(SESSION_STORE, requestId);
}

export async function getUploadTarget(requestId: string, clientId: string) {
    return getRecord<PersistedUploadTarget>(TARGET_STORE, [requestId, clientId]);
}

export async function getUploadIntent(requestId: string, intentId: string) {
    return getRecord<PersistedUploadIntent>(INTENT_STORE, [requestId, intentId]);
}

export async function listUploadTargets(requestId: string) {
    return getRecordsByRequestId<PersistedUploadTarget>(TARGET_STORE, requestId);
}

export async function listUploadIntents(requestId: string) {
    return getRecordsByRequestId<PersistedUploadIntent>(INTENT_STORE, requestId);
}

export async function loadUploadSessionSnapshot(
    requestId: string,
): Promise<UploadSessionSnapshot | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(
        [SESSION_STORE, TARGET_STORE, INTENT_STORE],
        "readonly",
    );
    const sessionRequest = transaction.objectStore(SESSION_STORE).get(requestId);
    const targetsRequest = transaction
        .objectStore(TARGET_STORE)
        .index(REQUEST_ID_INDEX)
        .getAll(requestId);
    const intentsRequest = transaction
        .objectStore(INTENT_STORE)
        .index(REQUEST_ID_INDEX)
        .getAll(requestId);
    const [session, targets, intents] = await Promise.all([
        requestResult<PersistedUploadSession | undefined>(sessionRequest),
        requestResult<PersistedUploadTarget[]>(targetsRequest),
        requestResult<PersistedUploadIntent[]>(intentsRequest),
        transactionDone(transaction),
    ]);

    if (!session) return undefined;
    return { session, targets, intents };
}

export async function listUploadSessionSnapshots() {
    const sessions = await getAllRecords<PersistedUploadSession>(SESSION_STORE);
    return Promise.all(sessions.map((session) => loadRequiredSnapshot(session.requestId)));
}

export async function listIncompleteUploadSessionSnapshots() {
    return (await listUploadSessionSnapshots()).filter(
        (snapshot) => snapshot.session.status !== "completed",
    );
}

export async function deleteUploadTarget(requestId: string, clientId: string) {
    await deleteRecord(TARGET_STORE, [requestId, clientId]);
}

export async function deleteUploadIntent(requestId: string, intentId: string) {
    await deleteRecord(INTENT_STORE, [requestId, intentId]);
}

export async function deleteUploadSession(requestId: string) {
    const database = await openDatabase();
    const transaction = database.transaction(
        [SESSION_STORE, TARGET_STORE, INTENT_STORE],
        "readwrite",
    );
    transaction.objectStore(SESSION_STORE).delete(requestId);
    deleteRecordsByRequestId(transaction.objectStore(TARGET_STORE), requestId);
    deleteRecordsByRequestId(transaction.objectStore(INTENT_STORE), requestId);
    await transactionDone(transaction);
}

export async function acquireUploadSessionLease(params: {
    requestId: string;
    owner: string;
    ttlMs: number;
    now?: number;
}) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SESSION_STORE);
    const session = await requestResult<PersistedUploadSession | undefined>(
        store.get(params.requestId),
    );
    const now = params.now ?? Date.now();

    if (
        !session ||
        (session.leaseOwner &&
            session.leaseOwner !== params.owner &&
            (session.leaseUntil ?? 0) > now)
    ) {
        transaction.abort();
        await done.catch(() => undefined);
        return false;
    }

    store.put({
        ...session,
        leaseOwner: params.owner,
        leaseUntil: now + params.ttlMs,
        updatedAt: now,
    });
    await done;
    return true;
}

export async function renewUploadSessionLease(params: {
    requestId: string;
    owner: string;
    ttlMs: number;
    now?: number;
}) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SESSION_STORE);
    const session = await requestResult<PersistedUploadSession | undefined>(
        store.get(params.requestId),
    );
    const now = params.now ?? Date.now();

    if (!session || session.leaseOwner !== params.owner || (session.leaseUntil ?? 0) <= now) {
        transaction.abort();
        await done.catch(() => undefined);
        return false;
    }

    store.put({ ...session, leaseUntil: now + params.ttlMs, updatedAt: now });
    await done;
    return true;
}

export async function releaseUploadSessionLease(requestId: string, owner: string) {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SESSION_STORE);
    const session = await requestResult<PersistedUploadSession | undefined>(store.get(requestId));

    if (!session || session.leaseOwner !== owner) {
        transaction.abort();
        await done.catch(() => undefined);
        return false;
    }

    const releasedSession = { ...session };
    delete releasedSession.leaseOwner;
    delete releasedSession.leaseUntil;
    releasedSession.updatedAt = Date.now();
    store.put(releasedSession);
    await done;
    return true;
}

async function openDatabase() {
    if (databasePromise) return databasePromise;
    if (typeof indexedDB === "undefined") {
        throw new Error("IndexedDB is not supported in this browser.");
    }

    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(SESSION_STORE)) {
                database.createObjectStore(SESSION_STORE, { keyPath: "requestId" });
            }
            if (!database.objectStoreNames.contains(TARGET_STORE)) {
                const store = database.createObjectStore(TARGET_STORE, {
                    keyPath: ["requestId", "clientId"],
                });
                store.createIndex(REQUEST_ID_INDEX, REQUEST_ID_INDEX);
            }
            if (!database.objectStoreNames.contains(INTENT_STORE)) {
                const store = database.createObjectStore(INTENT_STORE, {
                    keyPath: ["requestId", "intentId"],
                });
                store.createIndex(REQUEST_ID_INDEX, REQUEST_ID_INDEX);
            }
        };
        request.onsuccess = () => {
            request.result.onversionchange = () => {
                request.result.close();
                databasePromise = undefined;
            };
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Akasha upload database upgrade was blocked."));
    });

    try {
        return await databasePromise;
    } catch (error: unknown) {
        databasePromise = undefined;
        throw error;
    }
}

async function putRecord(storeName: string, value: object) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
}

async function putRecords(storeName: string, values: object[]) {
    if (values.length === 0) return;
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    await transactionDone(transaction);
}

async function getRecord<T>(storeName: string, key: IDBValidKey) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionDone(transaction);
    const result = await requestResult<T | undefined>(transaction.objectStore(storeName).get(key));
    await done;
    return result;
}

async function getAllRecords<T>(storeName: string) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionDone(transaction);
    const result = await requestResult<T[]>(transaction.objectStore(storeName).getAll());
    await done;
    return result;
}

async function getRecordsByRequestId<T>(storeName: string, requestId: string) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionDone(transaction);
    const result = await requestResult<T[]>(
        transaction.objectStore(storeName).index(REQUEST_ID_INDEX).getAll(requestId),
    );
    await done;
    return result;
}

async function deleteRecord(storeName: string, key: IDBValidKey) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
}

function deleteRecordsByRequestId(store: IDBObjectStore, requestId: string) {
    const request = store.index(REQUEST_ID_INDEX).openKeyCursor(IDBKeyRange.only(requestId));
    request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
    };
}

function requestResult<T>(request: IDBRequest) {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
            reject(transaction.error ?? new DOMException("Aborted", "AbortError"));
    });
}

async function loadRequiredSnapshot(requestId: string) {
    const snapshot = await loadUploadSessionSnapshot(requestId);
    if (!snapshot) throw new Error(`Upload session disappeared while loading: ${requestId}`);
    return snapshot;
}
