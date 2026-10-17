import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { StorageOperations, StoredFileInput, StoredFileOutput } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import { AppError } from "../../src/shared/presentation/http/app-error.js";
import type { IUsersRepository } from "../../src/modules/users/domain/interfaces/users-repository.interface.js";
import { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserController } from "../../src/modules/users/presentation/controllers/users.controller.js";
import { StoredFileValidationError } from "../../src/modules/storage/domain/validation/file-validation.js";
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
    { name: "profileImage", contentType: "image/png", content: Buffer.alloc(10 * 1024 * 1024 + 1) },
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
  const valid = { image: { content: Buffer.from([1, 2, 3]), contentType: "image/png", size: 3 } };
  assert.equal(uploadProfileImageSchema.safeParse(valid).success, true);
  for (const image of [
    { ...valid.image, contentType: "text/plain" },
    { ...valid.image, size: 2 },
    { ...valid.image, content: "AQID" },
    { content: Buffer.alloc(10 * 1024 * 1024 + 1), contentType: "image/png", size: 10 * 1024 * 1024 + 1 },
  ]) {
    assert.equal(uploadProfileImageSchema.safeParse({ image }).success, false);
  }
});

test("controller normalizes req.file and delegates profile replacement to storage", async () => {
  const calls: StoredFileInput[] = [];
  const storageProvider: StorageOperations = {
    async upload() {}, async delete() {}, async getPresignedUrl() { return "unused"; },
    async replaceFileContent(input): Promise<StoredFileOutput> {
      calls.push(input);
      return { file: {} as never, url: "https://storage.example/profile.png", expiresAt: new Date("2026-01-01T00:30:00Z") };
    },
  };
  const repository = { findActiveUser: async () => ({ id: profileId }) } as unknown as IUsersRepository;
  const controller = new UserController(new UserService(repository, storageProvider, noopLogger));
  const sent: unknown[] = [];
  const response = {
    status(status: number) { assert.equal(status, 200); return this; },
    json(body: unknown) { sent.push(body); return this; },
  } as unknown as Response;
  const request = {
    auth: { userId: profileId, sessionId: "session-id" },
    body: { userId: "123e4567-e89b-42d3-a456-426614174001" },
    file: { buffer: Buffer.from([1, 2, 3]), mimetype: "image/png", size: 3 },
  } as unknown as Request;
  await controller.uploadProfileImage(request, response);
  assert.deepEqual(sent, [{ data: { url: "https://storage.example/profile.png", expiresAt: new Date("2026-01-01T00:30:00Z") } }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.ownerUserId, profileId);
  assert.equal(calls[0]?.contextId, profileId);
  assert.deepEqual(calls[0]?.content, Buffer.from([1, 2, 3]));
});

test("controller rejects missing files and invalid image data before storage", async () => {
  let replacements = 0;
  const storageProvider: StorageOperations = { async upload() {}, async delete() {}, async getPresignedUrl() { return "unused"; }, async replaceFileContent() { replacements++; throw new Error("Não deveria ser chamado."); } };
  const repository = { findActiveUser: async () => ({ id: profileId }) } as unknown as IUsersRepository;
  const controller = new UserController(new UserService(repository, storageProvider, noopLogger));
  for (const request of [
    { body: { userId: profileId }, file: { buffer: Buffer.from([1]), mimetype: "image/png", size: 1 } },
    { auth: { userId: profileId, sessionId: "session-id" }, body: { userId: "../outside" }, file: { buffer: Buffer.from([1]), mimetype: "text/plain", size: 1 } },
  ]) {
    await assert.rejects(controller.uploadProfileImage(request as unknown as Request, {} as Response), AppError);
  }
  assert.equal(replacements, 0);
});

test("controller rejects requests without the authenticated context", async () => {
  const storageProvider: StorageOperations = {
    async upload() {}, async delete() {}, async getPresignedUrl() { return "unused"; },
    async replaceFileContent() { throw new Error("Não deveria ser chamado."); },
  };
  const repository = { findActiveUser: async () => ({ id: profileId }) } as unknown as IUsersRepository;
  const controller = new UserController(new UserService(repository, storageProvider, noopLogger));

  await assert.rejects(controller.uploadProfileImage({
    body: { userId: profileId },
    file: { buffer: Buffer.from([1, 2, 3]), mimetype: "image/png", size: 3 },
  } as unknown as Request, {} as Response), (error: unknown) => error instanceof AppError && error.status === 401);
});

test("controller maps storage file validation failures to HTTP validation errors", async () => {
  const storageProvider: StorageOperations = {
    async upload() {}, async delete() {}, async getPresignedUrl() { return "unused"; },
    async replaceFileContent() { throw new StoredFileValidationError("O conteúdo do arquivo está corrompido."); },
  };
  const repository = { findActiveUser: async () => ({ id: profileId }) } as unknown as IUsersRepository;
  const controller = new UserController(new UserService(repository, storageProvider, noopLogger));
  const request = {
    auth: { userId: profileId, sessionId: "session-id" },
    file: { buffer: Buffer.from([1, 2, 3]), mimetype: "image/png", size: 3 },
  } as unknown as Request;

  await assert.rejects(controller.uploadProfileImage(request, {} as Response), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "O conteúdo do arquivo está corrompido.");
    return true;
  });
});
