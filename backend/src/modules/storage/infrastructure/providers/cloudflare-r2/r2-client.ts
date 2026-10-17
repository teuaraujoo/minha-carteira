import { S3Client } from "@aws-sdk/client-s3";

export interface R2ClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
}

export function createR2Client(config: R2ClientConfig): { client: S3Client; bucket: string } {
  return {
    client: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
    bucket: config.bucket,
  };
}
