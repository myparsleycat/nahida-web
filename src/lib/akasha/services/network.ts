export class ByteSemaphore {
    private available: number;
    private waitQueue: Array<{ amount: number; resolve: () => void }> = [];

    constructor(private maxBytes: number) {
        this.available = maxBytes;
    }

    async acquire(amount: number): Promise<void> {
        const capped = Math.min(amount, this.maxBytes);
        if (this.available >= capped && this.waitQueue.length === 0) {
            this.available -= capped;
            return;
        }
        await new Promise<void>((resolve) => {
            this.waitQueue.push({ amount: capped, resolve });
        });
    }

    release(amount: number): void {
        this.available += Math.min(amount, this.maxBytes);
        this.processQueue();
    }

    private processQueue(): void {
        while (this.waitQueue.length > 0 && this.available >= this.waitQueue[0].amount) {
            const entry = this.waitQueue.shift()!;
            this.available -= entry.amount;
            entry.resolve();
        }
    }
}

export class ConcurrencySemaphore {
    private available: number;
    private waitQueue: Array<() => void> = [];

    constructor(private maxConcurrency: number) {
        this.available = maxConcurrency;
    }

    async acquire(): Promise<void> {
        if (this.available <= 0) {
            await new Promise<void>((resolve) => this.waitQueue.push(resolve));
        }
        this.available--;
    }

    release(): void {
        this.available++;
        if (this.waitQueue.length > 0 && this.available > 0) {
            const resolve = this.waitQueue.shift();
            if (resolve) {
                resolve();
            }
        }
    }
}
