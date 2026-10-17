import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorageProvider } from "../../../domain/interfaces/storage.interfaces.js";
import { StorageProviderError } from "../../../domain/errors/storage-provider.error.js";

export class R2StorageService implements ObjectStorageProvider {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) { }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    } catch (error) {
      throw new StorageProviderError("Não foi possível armazenar o arquivo no Cloudflare R2.", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw new StorageProviderError("Não foi possível remover o arquivo do Cloudflare R2.", error);
    }
  }

  async getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
    } catch (error) {
      throw new StorageProviderError("Não foi possível gerar a URL temporária do arquivo.", error);
    }
  }
}
