const calculateSHA256WebCrypto = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        const cleanup = () => {
            reader.onload = null;
            reader.onerror = null;
            reader.onabort = null;
        };

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
                cleanup();
                resolve(hashHex);
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        reader.onerror = () => {
            const error = reader.error;
            cleanup();
            reject(error);
        };

        reader.onabort = () => {
            cleanup();
            reject(new Error("FileReader aborted"));
        };

        reader.readAsArrayBuffer(file);
    });
};

self.onmessage = async (e) => {
    const { files } = e.data;
    const hashes: [string, string][] = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const { FID, file } = files[i];
            const hash = await calculateSHA256WebCrypto(file);
            hashes.push([FID, hash]);

            files[i].file = null;
            files[i] = null;

            self.postMessage({ type: "progress", fileIndex: i });
        }

        self.postMessage({ type: "complete", hashes });
    } catch (error: any) {
        self.postMessage({ type: "error", error: error.message });
    } finally {
        files.length = 0;
    }
};
