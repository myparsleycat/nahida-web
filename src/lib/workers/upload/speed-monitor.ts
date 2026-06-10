import type { ProgressMessage } from "../types";

interface UploadFileInfo {
    uploadedBytes: number;
    totalBytes: number;
    isUploading: boolean;
}

export class SpeedMonitor {
    private totalUploadedBytes = 0;
    private lastProgressUpdate = 0;
    private activeUploads = new Map<string, UploadFileInfo>();
    private speedUpdateInterval: number | null = null;
    private prevUploadedBytes = 0;
    private uploadSpeeds: number[] = [];
    private isUploading = false;

    constructor(private readonly postMessage: (msg: ProgressMessage) => void) {}

    start(pid: string) {
        if (this.speedUpdateInterval !== null) return;

        this.lastProgressUpdate = Date.now();
        this.prevUploadedBytes = 0;
        this.uploadSpeeds = [];
        this.isUploading = true;

        this.speedUpdateInterval = self.setInterval(() => {
            this.updateSpeed(pid);
        }, 1000);
    }

    stop() {
        if (this.speedUpdateInterval !== null) {
            self.clearInterval(this.speedUpdateInterval);
            this.speedUpdateInterval = null;
        }
    }

    updateProgress(fileId: string, uploadedBytes: number, totalBytes: number, isActive: boolean) {
        if (!isActive && uploadedBytes >= totalBytes) {
            this.activeUploads.delete(fileId);
        } else {
            this.activeUploads.set(fileId, {
                uploadedBytes: Math.min(uploadedBytes, totalBytes),
                totalBytes,
                isUploading: isActive,
            });
        }
    }

    postGlobalProgress(pid: string, totalBytes: number) {
        const currentTotalUploaded = Array.from(this.activeUploads.values()).reduce(
            (sum, file) => sum + file.uploadedBytes,
            0,
        );

        this.totalUploadedBytes = currentTotalUploaded;

        this.postMessage({
            type: "progress",
            action: "upload_file",
            pid,
            success: true,
            bytesUploaded: this.totalUploadedBytes,
            totalBytes,
        } as ProgressMessage);
    }

    private updateSpeed(pid: string) {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastProgressUpdate) / 1000;

        if (elapsedSeconds < 0.1) return;

        let currentTotalUploaded = 0;
        for (const info of this.activeUploads.values()) {
            if (info.isUploading) {
                currentTotalUploaded += info.uploadedBytes;
            }
        }
        currentTotalUploaded += this.totalUploadedBytes;

        const bytesChange = Math.max(0, currentTotalUploaded - this.prevUploadedBytes);
        const instantSpeed = bytesChange / elapsedSeconds;

        this.prevUploadedBytes = currentTotalUploaded;
        this.lastProgressUpdate = now;

        this.uploadSpeeds.push(instantSpeed);
        if (this.uploadSpeeds.length > 5) {
            this.uploadSpeeds.shift();
        }

        const weightedAvg = this.uploadSpeeds.reduce(
            (acc, speed, i) => ({
                sum: acc.sum + speed * (i + 1),
                weight: acc.weight + (i + 1),
            }),
            { sum: 0, weight: 0 },
        );

        let avgSpeed = weightedAvg.weight > 0 ? weightedAvg.sum / weightedAvg.weight : 0;

        if (avgSpeed === 0 && this.isUploading) {
            const lastNonZero = this.uploadSpeeds.reduce((last, s) => (s > 0 ? s : last), 0);
            if (lastNonZero > 0) {
                avgSpeed = lastNonZero * 0.5;
            }
        }

        this.postMessage({
            type: "progress",
            action: "upload_speed",
            pid,
            success: true,
            uploadBytesPerSec: avgSpeed,
        } as ProgressMessage);
    }
}
