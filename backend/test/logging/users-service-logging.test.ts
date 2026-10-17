import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createApp } from "../../src/app/app.js";
import { UserService } from "../../src/modules/users/application/services/users.service.js";
import type { IUsersRepository } from "../../src/modules/users/domain/interfaces/users-repository.interface.js";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import type { IStorageProvider } from "../../src/shared/domain/interfaces/storage.interface.js";
import { LogContext } from "../../src/shared/infrastructure/logging/log-context.js";
import { createRequestLoggingMiddleware } from "../../src/shared/presentation/middlewares/request-logging-middleware.js";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const input = { userId, image: { content: Buffer.from([1, 2, 3]), contentType: "image/png", size: 3 } };

class CapturingLogger implements AppLogger {
  readonly logs: Array<{ level: string; input: LogInput }> = [];
  debug(input: LogInput): void { this.logs.push({ level: "debug", input }); }
  info(input: LogInput): void { this.logs.push({ level: "info", input }); }
  warn(input: LogInput): void { this.logs.push({ level: "warn", input }); }
  error(input: LogInput): void { this.logs.push({ level: "error", input }); }
  fatal(input: LogInput): void { this.logs.push({ level: "fatal", input }); }
  async close(): Promise<void> {}
}

function repository(profile: unknown): IUsersRepository {
  return { findActiveUser: async () => profile } as unknown as IUsersRepository;
}

test("UserService logs the confirmed upload with request context and approved fields", async () => {
  const logger = new CapturingLogger();
  const logContext = new LogContext(logger);
  let confirmUpload: (() => void) | undefined;
  const uploaded = new Promise<void>((resolve) => { confirmUpload = resolve; });
  const storageProvider: IStorageProvider = {
    upload: async () => uploaded,
    getPresignedUrl: async () => "https://storage.example/profile.png",
  };
  const service = new UserService(repository({ id: userId }), storageProvider, logContext);

  await logContext.runWithRequest("internal-request-id", async () => {
    const result = service.uploadProfileImage(input);
    await Promise.resolve();
    assert.deepEqual(logger.logs, []);
    confirmUpload?.();
    assert.deepEqual(await result, { url: "https://storage.example/profile.png" });
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
  const storageProvider: IStorageProvider = {
    upload: async () => undefined,
    getPresignedUrl: async () => "unused",
  };
  const service = new UserService(repository({ id: userId }), storageProvider, logContext);
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
  let uploads = 0;
  const storageProvider: IStorageProvider = {
    upload: async () => { uploads++; },
    getPresignedUrl: async () => "unused",
  };
  const service = new UserService(repository(null), storageProvider, new LogContext(logger));

  await assert.rejects(service.uploadProfileImage(input), { message: "Usuário não encontrado." });
  assert.equal(uploads, 0);
  assert.deepEqual(logger.logs, []);
});

test("UserService propagates upload failures without a success log", async () => {
  const logger = new CapturingLogger();
  const failure = new Error("Falha de armazenamento");
  const storageProvider: IStorageProvider = {
    upload: async () => { throw failure; },
    getPresignedUrl: async () => "unused",
  };
  const service = new UserService(repository({ id: userId }), storageProvider, new LogContext(logger));

  await assert.rejects(service.uploadProfileImage(input), (error) => error === failure);
  assert.deepEqual(logger.logs, []);
});

test("createApp preserves logger-only and default composition options", () => {
  const logger = new CapturingLogger();
  assert.equal(typeof createApp({ logger }).listen, "function");
  assert.equal(typeof createApp().listen, "function");
});
