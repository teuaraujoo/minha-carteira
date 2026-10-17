import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { IStorageProvider } from "../../../domain/interfaces/storage.interface.js";

export class R2Client implements IStorageProvider {
    r2Client: S3Client;
    bucket: string;
    private readonly CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    private readonly CLOUDFLARE_R2_SECRET_ID = process.env.CLOUDFLARE_R2_SECRET_ID;
    private readonly CLOUDFLARE_R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;
    private readonly CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;

    constructor() {
        if (!this.CLOUDFLARE_R2_ACCESS_KEY_ID) {
            throw new Error("A variável CLOUDFLARE_R2_ACCESS_KEY_ID é obrigatória.")
        }

        if (!this.CLOUDFLARE_R2_ENDPOINT) {
            throw new Error("A variável CLOUDFLARE_R2_ENDPOINT é obrigatória.")
        }

        if (!this.CLOUDFLARE_R2_SECRET_ID) {
            throw new Error("A variável CLOUDFLARE_R2_SECRET_ID é obrigatória.")
        }

        if (!this.CLOUDFLARE_R2_BUCKET_NAME) {
            throw new Error("A variável CLOUDFLARE_R2_BUCKET_NAME é obrigatória.")
        }

        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: this.CLOUDFLARE_R2_ENDPOINT,
            credentials: {
                accessKeyId: this.CLOUDFLARE_R2_ACCESS_KEY_ID,
                secretAccessKey: this.CLOUDFLARE_R2_SECRET_ID,
            },
        });
        this.bucket = this.CLOUDFLARE_R2_BUCKET_NAME
    }

    upload(key: string, body: Buffer, contentType: string): Promise<unknown> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType
        });

        return this.r2Client.send(command);
    }

    getPresignedUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        })

        return getSignedUrl(this.r2Client, command, { expiresIn: 3600 });
    }
}
