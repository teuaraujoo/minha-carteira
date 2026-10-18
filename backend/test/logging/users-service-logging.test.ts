import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createApp } from "../../src/app/app.js";
import { createUserService } from "../users/user-service.test-support.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import { LogContext } from "../../src/shared/infrastructure/logging/log-context.js";
import { createRequestLoggingMiddleware } from "../../src/shared/presentation/middlewares/request-logging-middleware.js";
import { createUsersRepositoryDouble } from "../users/users-repository.double.js";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const input = { userId, image: { content: Buffer.from([1, 2, 3]), contentType: "image/png", size: 3 } };

class CapturingLogger implements AppLogger {
  readonly logs: Array<{ level: string; input: LogInput }> = [];
  debug(input: LogInput): void { this.logs.push({ level: "debug", input }); }
  info(input: LogInput): void { this.logs.push({ level: "info", input }); }
  warn(input: LogInput): void { this.logs.push({ level: "warn", input }); }
  error(input: LogInput): void { this.logs.push({ level: "error", input }); }
  fatal(input: LogInput): void { this.logs.push({ level: "fatal", input }); }
  async close(): Promise<void> { }
}

function repository(profile: User | null) {
  return createUsersRepositoryDouble({ findActiveById: async () => profile });
}

function createProfile(): User {
  return User.create({
    id: userId,
    username: "profile-user",
    name: "Profile User",
    email: "profile@example.com",
    phone: "+5585999999999",
    passwordHash: "hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

test("UserService logs the confirmed upload with request context and approved fields", async () => {
  const logger = new CapturingLogger();
  const logContext = new LogContext(logger);
  let confirmUpload: (() => void) | undefined;
  const uploaded = new Promise<void>((resolve) => { confirmUpload = resolve; });
  const storageProvider: StorageOperations = {
    upload: async () => undefined,
    delete: async () => undefined,
    getPresignedUrl: async () => "https://storage.example/profile.png",
    replaceFileContent: async () => { await uploaded; return { file: {} as never, url: "https://storage.example/profile.png", expiresAt: new Date("2026-01-01T00:30:00Z") }; },
  };
  const service = createUserService(repository(createProfile()), storageProvider, logContext);

  await logContext.runWithRequest("internal-request-id", async () => {
    const result = service.uploadProfileImage(input);
    await Promise.resolve();
    assert.deepEqual(logger.logs, []);
    confirmUpload?.();
    assert.deepEqual(await result, { url: "https://storage.example/profile.png", expiresAt: new Date("2026-01-01T00:30:00Z") });
  });

  assert.equal(logger.logs.length, 1);
  assert.equal(logger.logs[0]?.level, "info");
  assert.deepEqual({ ...logger.logs[0]?.input }, {
    event: "users.profile-image.uploaded",
    module: "users",
    message: "Imagem de perfil armazenada com sucesso",
    requestId: "internal-request-id",
    context: { operation: "uploadProfileImage", userId },
  });
  assert.equal(JSON.stringify(logger.logs).includes("storage.example"), false);
  assert.equal(JSON.stringify(logger.logs).includes("image/png"), false);
});

test("HTTP middleware and service share the same contextual requestId", async () => {
  const logger = new CapturingLogger();
  const logContext = new LogContext(logger);
  const storageProvider: StorageOperations = {
    upload: async () => undefined,
    delete: async () => undefined,
    getPresignedUrl: async () => "unused",
    replaceFileContent: async () => ({ file: {} as never, url: "unused", expiresAt: new Date() }),
  };
  const service = createUserService(repository(createProfile()), storageProvider, logContext);
  const request = { method: "POST", baseUrl: "", route: { path: "/users/:id/image" } } as unknown as Request;
  const response = Object.assign(new EventEmitter(), { locals: {}, statusCode: 200 }) as unknown as Response;
  let upload: Promise<unknown> | undefined;

  createRequestLoggingMiddleware(logContext)(request, response, (() => {
    upload = service.uploadProfileImage(input);
  }) as NextFunction);
  await upload;
  response.emit("finish");

  const serviceLog = logger.logs.find(({ input: entry }) => entry.event === "users.profile-image.uploaded");
  const requestLog = logger.logs.find(({ input: entry }) => entry.event === "http.request.completed");
  assert.equal(serviceLog?.input.requestId, response.locals.requestId);
  assert.equal(serviceLog?.input.requestId, requestLog?.input.requestId);
  assert.match(serviceLog?.input.requestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("UserService does not log upload success when the user is absent", async () => {
  const logger = new CapturingLogger();
  let replacements = 0;
  const storageProvider: StorageOperations = {
    upload: async () => undefined,
    delete: async () => undefined,
    getPresignedUrl: async () => "unused",
    replaceFileContent: async () => { replacements++; return { file: {} as never, url: "unused", expiresAt: new Date() }; },
  };
  const service = createUserService(repository(null), storageProvider, new LogContext(logger));

  await assert.rejects(service.uploadProfileImage(input), (error) => error instanceof AppError && error.status === 404 && error.code === ErrorCode.NOT_FOUND);
  assert.equal(replacements, 0);
  assert.deepEqual(logger.logs, []);
});

test("UserService propagates upload failures without a success log", async () => {
  const logger = new CapturingLogger();
  const failure = new Error("Falha de armazenamento");
  const storageProvider: StorageOperations = {
    upload: async () => undefined,
    delete: async () => undefined,
    getPresignedUrl: async () => "unused",
    replaceFileContent: async () => { throw failure; },
  };
  const service = createUserService(repository(createProfile()), storageProvider, new LogContext(logger));

  await assert.rejects(service.uploadProfileImage(input), (error) => error === failure);
  assert.deepEqual(logger.logs, []);
});

test("createApp preserves logger-only and default composition options", () => {
  const logger = new CapturingLogger();
  assert.equal(typeof createApp({ logger }).listen, "function");
  assert.equal(typeof createApp().listen, "function");
});
