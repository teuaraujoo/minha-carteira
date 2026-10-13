import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { Writable } from "node:stream";
import type { Logger as PinoLogger } from "pino";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import {
  createPinoAppLogger,
  PinoAppLogger,
  resolveLoggerConfiguration,
} from "../../src/shared/infrastructure/logging/pino-app-logger.js";

function captureDestination(): { destination: Writable; lines: () => Array<Record<string, unknown>> } {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return {
    destination,
    lines: () => output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

test("logger configuration applies precedence, environment defaults and development-only pretty", () => {
  assert.deepEqual(resolveLoggerConfiguration({ environment: { NODE_ENV: "development" } }), { level: "debug", pretty: true });
  assert.deepEqual(resolveLoggerConfiguration({ environment: { NODE_ENV: "production" } }), { level: "info", pretty: false });
  assert.deepEqual(resolveLoggerConfiguration({ environment: { NODE_ENV: "development", LOG_LEVEL: "warn" }, pretty: false }), { level: "warn", pretty: false });
  assert.deepEqual(resolveLoggerConfiguration({ level: "fatal", environment: { NODE_ENV: "development", LOG_LEVEL: "error" } }), { level: "fatal", pretty: true });
  assert.equal(resolveLoggerConfiguration({ environment: { NODE_ENV: "development" }, destination: captureDestination().destination }).pretty, false);
  assert.throws(() => resolveLoggerConfiguration({ environment: { LOG_LEVEL: "verbose" } }), /LOG_LEVEL inválido/);
});

test("production emits exact NDJSON fields, textual levels and no Pino metadata", () => {
  const capture = captureDestination();
  const logger = createPinoAppLogger({ environment: { NODE_ENV: "production" }, destination: capture.destination });
  logger.info({
    event: "server.started",
    module: "server",
    message: "Servidor iniciado",
    context: { operation: "listen", count: 1 },
  });
  const [record] = capture.lines();
  assert.deepEqual(Object.keys(record ?? {}).sort(), ["context", "event", "level", "message", "module", "timestamp"].sort());
  assert.equal(record?.level, "info");
  assert.equal(record?.event, "server.started");
  assert.equal(record?.message, "Servidor iniciado");
  assert.match(String(record?.timestamp), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  for (const forbidden of ["time", "msg", "req", "res", "pid", "hostname", "schemaVersion", "service", "environment", "durationMs"]) {
    assert.equal(Object.hasOwn(record ?? {}, forbidden), false);
  }
});

test("all contracted levels are textual and level filtering is respected", () => {
  const capture = captureDestination();
  const logger = createPinoAppLogger({ level: "debug", environment: { NODE_ENV: "production" }, destination: capture.destination });
  const input = { event: "server.started" as const, module: "server" as const, message: "Evento" };
  logger.debug(input);
  logger.info(input);
  logger.warn(input);
  logger.error(input);
  logger.fatal(input);
  assert.deepEqual(capture.lines().map((record) => record.level), ["debug", "info", "warn", "error", "fatal"]);

  const filteredCapture = captureDestination();
  const filtered = createPinoAppLogger({ level: "warn", destination: filteredCapture.destination, environment: {} });
  filtered.debug(input);
  filtered.info(input);
  filtered.warn(input);
  assert.deepEqual(filteredCapture.lines().map((record) => record.level), ["warn"]);
});

test("adapter filters context, sanitizes fields and produces internal diagnostics in production", () => {
  const capture = captureDestination();
  const logger = createPinoAppLogger({ destination: capture.destination, environment: { NODE_ENV: "production" } });
  const error = new AppError({
    status: 409,
    code: ErrorCode.CONFLICT,
    message: "Conflito token=synthetic-secret",
    details: { accountId: "internal-id", password: "synthetic-secret" },
    cause: new Error("Bearer synthetic-secret"),
  });
  logger.error({
    event: "http.request.failed",
    module: "http",
    message: "Falha para person@example.com",
    requestId: "safe-request-id",
    context: { operation: "create", count: 2, userId: "user-id", extra: "forbidden" } as never,
    http: { method: "POST", route: "/accounts/:id", statusCode: 409 },
    error,
  });
  const [record] = capture.lines();
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes("synthetic-secret"), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.deepEqual(record?.context, { operation: "create", count: 2, userId: "user-id" });
  assert.deepEqual(record?.http, { method: "POST", route: "/accounts/:id", statusCode: 409 });
  const diagnostic = record?.error as Record<string, unknown>;
  assert.equal(diagnostic.code, "CONFLICT");
  assert.equal(diagnostic.status, 409);
  assert.deepEqual(diagnostic.details, { accountId: "internal-id", password: "[REMOVIDO]" });
});

test("write failures and asynchronous destination errors never escape application logging", () => {
  const destination = Object.assign(new EventEmitter(), {
    write() { throw new Error("synthetic destination failure"); },
  });
  const logger = createPinoAppLogger({ destination, environment: {} });
  assert.doesNotThrow(() => logger.error({ event: "server.failed", module: "server", message: "Falha", error: new Error("business failure") }));
  assert.doesNotThrow(() => destination.emit("error", new Error("synthetic async failure")));
});

test("close is idempotent and does not close an injected destination", async () => {
  const capture = captureDestination();
  let ended = false;
  capture.destination.once("finish", () => { ended = true; });
  const logger = createPinoAppLogger({ destination: capture.destination, environment: {} });
  const first = logger.close();
  const second = logger.close();
  assert.strictEqual(first, second);
  await first;
  assert.equal(ended, false);
});

test("close waits for an internally owned destination", async () => {
  let destinationClosed = false;
  const destination = Object.assign(new EventEmitter(), {
    write() { return true; },
    end(callback?: () => void) {
      setTimeout(() => {
        destinationClosed = true;
        callback?.();
      }, 10);
    },
  });
  const pinoLogger = { flush() {} } as PinoLogger;
  const logger = new PinoAppLogger(pinoLogger, destination);
  let closeResolved = false;
  const closing = logger.close().then(() => { closeResolved = true; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(closeResolved, false);
  await closing;
  assert.equal(destinationClosed, true);
});

test("adapter does not execute hostile LogInput or HTTP getters", () => {
  const capture = captureDestination();
  const logger = createPinoAppLogger({ destination: capture.destination, environment: {} });
  let getterCalls = 0;
  const input = Object.defineProperties({}, {
    event: { enumerable: true, value: "server.started" },
    module: { enumerable: true, value: "server" },
    message: { enumerable: true, get() { getterCalls++; throw new Error("must not run"); } },
    http: { enumerable: true, value: Object.defineProperty({}, "method", { get() { getterCalls++; throw new Error("must not run"); } }) },
  });
  assert.doesNotThrow(() => logger.info(input as never));
  assert.equal(getterCalls, 0);
  assert.deepEqual(capture.lines(), []);
});

test("close resolves when an owned destination is already closed after an asynchronous error", async () => {
  const destination = Object.assign(new EventEmitter(), {
    closed: true,
    destroyed: true,
    write() { return false; },
    end() { assert.fail("must not end an already closed destination"); },
  });
  const logger = new PinoAppLogger({ flush() {} } as PinoLogger, destination);
  await logger.close();
});
