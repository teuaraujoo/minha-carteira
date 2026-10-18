import assert from "node:assert/strict";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import test from "node:test";
import { createR2Client } from "../../src/modules/storage/infrastructure/providers/cloudflare-r2/r2-client.js";
import { R2StorageService } from "../../src/modules/storage/infrastructure/providers/cloudflare-r2/r2-storage.service.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

test("R2 client is configured from explicit configuration and returns the bucket", () => {
  const configured = createR2Client({
    accessKeyId: "chave-de-teste",
    secretAccessKey: "segredo-de-teste",
    endpoint: "https://account.r2.cloudflarestorage.com",
    bucket: "minha-carteira-test",
  });

  assert.ok(configured.client instanceof S3Client);
  assert.equal(configured.bucket, "minha-carteira-test");
  configured.client.destroy();
});

test("R2 adapter sends upload and delete commands to the configured bucket", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) { commands.push(command); return {}; },
  } as unknown as S3Client;
  const storage = new R2StorageService(client, "minha-carteira-test");

  await storage.upload("profile/opaque-key", Buffer.from("conteudo"), "image/png");
  await storage.delete("profile/opaque-key");

  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal((commands[0] as PutObjectCommand).input.Bucket, "minha-carteira-test");
  assert.ok(commands[1] instanceof DeleteObjectCommand);
  assert.equal((commands[1] as DeleteObjectCommand).input.Bucket, "minha-carteira-test");
});

test("R2 adapter returns a temporary URL without sending an object request", async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: "https://account.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "chave-de-teste", secretAccessKey: "segredo-de-teste" },
  });
  const storage = new R2StorageService(client, "minha-carteira-test");

  try {
    const url = await storage.getPresignedUrl("profile/opaque-key", 1800);
    assert.match(url, /X-Amz-Expires=1800/);
  } finally {
    client.destroy();
  }
});

test("R2 adapter maps provider failures to a safe Portuguese error", async () => {
  const client = {
    async send() { throw new Error("Detalhe interno do provedor"); },
  } as unknown as S3Client;
  const storage = new R2StorageService(client, "minha-carteira-test");

  await assert.rejects(storage.upload("profile/opaque-key", Buffer.from("conteudo"), "image/png"), (error: unknown) => {
    assert.ok(error instanceof AppError && error.status === 500 && error.code === ErrorCode.INTERNAL_ERROR);
    assert.equal(error.message, "Não foi possível armazenar o arquivo no Cloudflare R2.");
    assert.equal(error.message.includes("Detalhe interno"), false);
    return true;
  });
});
