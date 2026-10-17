import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { IStorageProvider } from "../../src/shared/domain/interfaces/storage.interface.js";
import { noopLoggerAccessor } from "../../src/shared/application/logging/app-logger.js";
import { AppError } from "../../src/shared/presentation/http/app-error.js";
import type { IUsersRepository } from "../../src/modules/users/domain/interfaces/users-repository.interface.js";
import { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserController } from "../../src/modules/users/presentation/controllers/users.controller.js";
import { profileImageUpload } from "../../src/modules/users/presentation/middlewares/image-upload.middleware.js";
import { uploadProfileImageSchema } from "../../src/modules/users/presentation/schemas/users.schemas.js";

const profileId = "123e4567-e89b-42d3-a456-426614174000";
const boundary = "profile-image-test-boundary";

interface MultipartFile {
  name: string;
  contentType: string;
  content: Buffer;
}

function multipartBody(files: MultipartFile[], complete = true): Buffer {
  const parts: Buffer[] = [];
  for (const file of files) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="image.png"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    parts.push(file.content);
    parts.push(Buffer.from("\r\n"));
  }
  if (complete) parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

function runUpload(body: Buffer, contentType = `multipart/form-data; boundary=${boundary}`): Promise<{ request: Request; error: unknown }> {
  const request = Object.assign(Readable.from([body]), {
    headers: { "content-type": contentType, "content-length": String(body.length) },
    method: "POST",
  }) as unknown as Request;
  return new Promise((resolve) => {
    profileImageUpload(request, {} as Response, ((error: unknown) => resolve({ request, error })) as NextFunction);
  });
}

test("Multer parses profileImage into an in-memory buffer", async () => {
  const content = Buffer.from([1, 2, 3]);
  const { request, error } = await runUpload(multipartBody([{ name: "profileImage", contentType: "image/png", content }]));
  assert.equal(error, undefined);
  assert.deepEqual(request.file?.buffer, content);
  assert.equal(request.file?.size, 3);
  assert.equal(request.file?.mimetype, "image/png");
});

test("Multer rejects unsupported MIME and extra files with public validation errors", async () => {
  const content = Buffer.from([1]);
  const cases = [
    multipartBody([{ name: "profileImage", contentType: "text/plain", content }]),
    multipartBody([
      { name: "profileImage", contentType: "image/png", content },
      { name: "profileImage", contentType: "image/png", content },
    ]),
    multipartBody([{ name: "otherImage", contentType: "image/png", content }]),
  ];
  for (const body of cases) {
    const { error } = await runUpload(body);
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
  }
});

test("Multer maps file size and malformed multipart input to expected errors", async () => {
  const oversized = await runUpload(multipartBody([
    { name: "profileImage", contentType: "image/png", content: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]));
  assert.ok(oversized.error instanceof AppError);
  assert.equal(oversized.error.status, 413);

  const missingBoundary = await runUpload(Buffer.alloc(0), "multipart/form-data");
  assert.ok(missingBoundary.error instanceof AppError);
  assert.equal(missingBoundary.error.status, 400);
  assert.equal(missingBoundary.error.message, "Formulário de imagem inválido.");

  const truncated = await runUpload(multipartBody([
    { name: "profileImage", contentType: "image/png", content: Buffer.from([1]) },
  ], false));
  assert.ok(truncated.error instanceof AppError);
  assert.equal(truncated.error.status, 400);
  assert.equal(truncated.error.message, "Formulário de imagem inválido.");
});

test("schema accepts only normalized binary images within the approved types and size", () => {
  const valid = { profileId, image: { content: Buffer.from([1, 2, 3]), contentType: "image/png", size: 3 } };
  assert.equal(uploadProfileImageSchema.safeParse(valid).success, true);
  for (const image of [
    { ...valid.image, contentType: "text/plain" },
    { ...valid.image, size: 2 },
    { ...valid.image, content: "AQID" },
    { content: Buffer.alloc(5 * 1024 * 1024 + 1), contentType: "image/png", size: 5 * 1024 * 1024 + 1 },
  ]) {
    assert.equal(uploadProfileImageSchema.safeParse({ profileId, image }).success, false);
  }
});

test("controller normalizes req.file and service uploads to a stable profile key", async () => {
  const calls: Array<{ key: string; body: Buffer; contentType: string }> = [];
  const storageProvider: IStorageProvider = { async upload(key, body, contentType) { calls.push({ key, body, contentType }); }, async getPresignedUrl() { return "unused"; } };
  const controller = new UserController(new UserService({} as IUsersRepository, storageProvider, noopLoggerAccessor));
  const sent: unknown[] = [];
  const response = {
    status(status: number) { assert.equal(status, 200); return this; },
    json(body: unknown) { sent.push(body); return this; },
  } as unknown as Response;
  const request = {
    body: { profileId },
    file: { buffer: Buffer.from([1, 2, 3]), mimetype: "image/png", size: 3 },
  } as Request;
  await controller.uploadProfileImage(request, response);
  assert.deepEqual(sent, [{ data: { key: `users/${profileId}/profile-image` } }]);
  assert.deepEqual(calls, [{ key: `users/${profileId}/profile-image`, body: Buffer.from([1, 2, 3]), contentType: "image/png" }]);
});

test("controller rejects missing files and invalid profile IDs before storage", async () => {
  let uploads = 0;
  const storageProvider: IStorageProvider = { async upload() { uploads++; }, async getPresignedUrl() { return "unused"; } };
  const controller = new UserController(new UserService({} as IUsersRepository, storageProvider, noopLoggerAccessor));
  for (const request of [
    { body: { profileId } },
    { body: { profileId: "../outside" }, file: { buffer: Buffer.from([1]), mimetype: "image/png", size: 1 } },
  ]) {
    await assert.rejects(controller.uploadProfileImage(request as Request, {} as Response), AppError);
  }
  assert.equal(uploads, 0);
});
