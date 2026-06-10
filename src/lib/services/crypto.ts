import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export class CryptoService {
    private readonly algorithm = "aes-256-gcm";
    private readonly key: Buffer;

    constructor(secretKey: string) {
        this.key = scryptSync(secretKey, "salt", 32);
    }

    encrypt(plainText: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(plainText, "utf8", "hex");
        encrypted += cipher.final("hex");

        const authTag = cipher.getAuthTag();

        return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    }

    decrypt(encryptedText: string): string {
        const parts = encryptedText.split(":");
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted text format");
        }

        const [ivHex, authTagHex, contentHex] = parts;

        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = createDecipheriv(this.algorithm, this.key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(contentHex, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    }
}

export default CryptoService;
