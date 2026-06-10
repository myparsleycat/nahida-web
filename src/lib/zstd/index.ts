import wasmUrl from "@/lib/zstd/zstd_wasm_bg.wasm?url";

interface WasmExports {
    memory: WebAssembly.Memory;
    __wbindgen_malloc: (size: number, align: number) => number;
    __wbindgen_free: (ptr: number, size: number, align: number) => void;
    __wbindgen_add_to_stack_pointer: (n: number) => number;
    compress: (retptr: number, ptr: number, len: number, level: number) => void;
    decompress: (retptr: number, ptr: number, len: number) => void;
}

export default class ZstdWasm {
    private static instance: ZstdWasm | null = null;
    private wasm: WasmExports;
    private cachedUint8ArrayMemory0: Uint8Array | null = null;
    private cachedDataViewMemory0: DataView | null = null;
    private WASM_VECTOR_LEN: number = 0;

    private constructor(wasmExports: WasmExports) {
        this.wasm = wasmExports;
    }

    public static async getInstance(): Promise<ZstdWasm> {
        if (!ZstdWasm.instance) {
            let wasmExports: WasmExports;
            const response = await fetch(new URL(wasmUrl, import.meta.url).href);
            let wasmModule: WebAssembly.WebAssemblyInstantiatedSource;
            try {
                wasmModule = await WebAssembly.instantiateStreaming(response, {});
            } catch (e) {
                const bytes = await response.arrayBuffer();
                wasmModule = await WebAssembly.instantiate(bytes, {});
            }
            wasmExports = wasmModule.instance.exports as unknown as WasmExports;
            ZstdWasm.instance = new ZstdWasm(wasmExports);
        }
        return ZstdWasm.instance;
    }

    public static async initialize(): Promise<void> {
        await ZstdWasm.getInstance();
    }

    private getUint8ArrayMemory0(): Uint8Array {
        if (
            this.cachedUint8ArrayMemory0 === null ||
            this.cachedUint8ArrayMemory0.byteLength === 0
        ) {
            this.cachedUint8ArrayMemory0 = new Uint8Array(this.wasm.memory.buffer);
        }
        return this.cachedUint8ArrayMemory0;
    }

    private getDataViewMemory0(): DataView {
        if (
            this.cachedDataViewMemory0 === null ||
            this.cachedDataViewMemory0.buffer !== this.wasm.memory.buffer ||
            (this.cachedDataViewMemory0.buffer as any).detached === true
        ) {
            this.cachedDataViewMemory0 = new DataView(this.wasm.memory.buffer);
        }
        return this.cachedDataViewMemory0;
    }

    private passArray8ToWasm0(
        arg: Uint8Array,
        malloc: (size: number, align: number) => number,
    ): number {
        const ptr = malloc(arg.length, 1) >>> 0;
        this.getUint8ArrayMemory0().set(arg, ptr);
        this.WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    public compress(source: Uint8Array, level: number = 3): Uint8Array {
        const retptr = this.wasm.__wbindgen_add_to_stack_pointer(-16);
        try {
            const ptr0 = this.passArray8ToWasm0(source, this.wasm.__wbindgen_malloc);
            const len0 = this.WASM_VECTOR_LEN;
            this.wasm.compress(retptr, ptr0, len0, level);
            const mem = this.getDataViewMemory0();
            const r0 = mem.getInt32(retptr, true);
            const r1 = mem.getInt32(retptr + 4, true);
            const result = this.getUint8ArrayMemory0()
                .subarray(r0, r0 + r1)
                .slice();
            this.wasm.__wbindgen_free(r0, r1, 1);
            return result;
        } finally {
            this.wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }

    public decompress(source: Uint8Array): Uint8Array {
        const retptr = this.wasm.__wbindgen_add_to_stack_pointer(-16);
        try {
            const ptr0 = this.passArray8ToWasm0(source, this.wasm.__wbindgen_malloc);
            const len0 = this.WASM_VECTOR_LEN;
            this.wasm.decompress(retptr, ptr0, len0);
            const mem = this.getDataViewMemory0();
            const r0 = mem.getInt32(retptr, true);
            const r1 = mem.getInt32(retptr + 4, true);
            const result = this.getUint8ArrayMemory0()
                .subarray(r0, r0 + r1)
                .slice();
            this.wasm.__wbindgen_free(r0, r1, 1);
            return result;
        } finally {
            this.wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }

    public static async createCompressionStream(
        level: number = 3,
    ): Promise<TransformStream<Uint8Array, Uint8Array>> {
        const zstd = await ZstdWasm.getInstance();
        const chunks: Uint8Array[] = [];
        return new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                chunks.push(chunk);
            },
            flush(controller) {
                const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
                const input = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    input.set(chunk, offset);
                    offset += chunk.length;
                }
                const compressed = zstd.compress(input, level);
                controller.enqueue(compressed);
            },
        });
    }

    public static async createDecompressionStream(): Promise<
        TransformStream<Uint8Array, Uint8Array>
    > {
        const zstd = await ZstdWasm.getInstance();
        const root = await navigator.storage.getDirectory();

        const sessionId = `decompression-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const sessionDir = await root.getDirectoryHandle(sessionId, { create: true });

        let chunkCounter = 0;

        const storeChunk = async (chunk: Uint8Array): Promise<void> => {
            const chunkId = `chunk-${chunkCounter++}.bin`;
            const fileHandle = await sessionDir.getFileHandle(chunkId, { create: true });
            const writable = await fileHandle.createWritable();
            // @ts-ignore
            await writable.write(chunk);
            await writable.close();
        };

        const getAllChunks = async (): Promise<Uint8Array[]> => {
            const chunks: Uint8Array[] = [];

            for (let i = 0; i < chunkCounter; i++) {
                const chunkId = `chunk-${i}.bin`;
                try {
                    const fileHandle = await sessionDir.getFileHandle(chunkId);
                    const file = await fileHandle.getFile();
                    const chunk = new Uint8Array(await file.arrayBuffer());
                    chunks.push(chunk);
                } catch (error) {
                    console.error(`Failed to read chunk ${chunkId}:`, error);
                }
            }

            return chunks;
        };

        const cleanupChunks = async (): Promise<void> => {
            for (let i = 0; i < chunkCounter; i++) {
                const chunkId = `chunk-${i}.bin`;
                try {
                    await sessionDir.removeEntry(chunkId);
                } catch (error) {
                    console.error(`Failed to remove chunk ${chunkId}:`, error);
                }
            }

            try {
                await root.removeEntry(sessionId, { recursive: true });
            } catch (error) {
                console.error(`Failed to remove session directory:`, error);
            }
        };

        return new TransformStream<Uint8Array, Uint8Array>({
            async transform(chunk, controller) {
                await storeChunk(chunk);
            },
            async flush(controller) {
                try {
                    const chunks = await getAllChunks();

                    const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
                    const input = new Uint8Array(totalLength);
                    let offset = 0;

                    for (const chunk of chunks) {
                        input.set(chunk, offset);
                        offset += chunk.length;
                    }

                    const decompressed = zstd.decompress(input);
                    controller.enqueue(decompressed);
                } catch (error) {
                    controller.error(error);
                } finally {
                    await cleanupChunks();
                }
            },
        });
    }
}
