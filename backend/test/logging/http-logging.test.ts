import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import { createApp } from "../../src/app/app.js";
import { LogContext } from "../../src/shared/infrastructure/logging/log-context.js";
import { createPinoAppLogger } from "../../src/shared/infrastructure/logging/pino-app-logger.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { bodyParserErrorHandler, createErrorHandler, notFoundHandler, terminateStartedResponse } from "../../src/shared/presentation/http/error-middleware.js";
import { createRequestLoggingMiddleware, resolveRoutePattern } from "../../src/shared/presentation/http/request-logging-middleware.js";
import type { Express, NextFunction, Request, Response } from "express";

interface CapturedLog {
  level: string;
  input: LogInput;
}

class CapturingLogger implements AppLogger {
  readonly logs: CapturedLog[] = [];
  debug(input: LogInput): void { this.logs.push({ level: "debug", input }); }
  info(input: LogInput): void { this.logs.push({ level: "info", input }); }
  warn(input: LogInput): void { this.logs.push({ level: "warn", input }); }
  error(input: LogInput): void { this.logs.push({ level: "error", input }); }
  fatal(input: LogInput): void { this.logs.push({ level: "fatal", input }); }
  async close(): Promise<void> {}
}

async function withServer(app: Express, run: (url: string) => Promise<void>): Promise<void> {
  const server: Server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function fixtureApp(logger: AppLogger): Express {
  const app = express();
  const context = new LogContext(logger);
  app.use(createRequestLoggingMiddleware(context));
  app.use(express.json({ limit: "100kb" }));
  app.get(["/alias-a", "/alias-b"], (_request, response) => response.status(200).json({ ok: true }));
  app.get("/expected/:id", () => { throw new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "Estado em conflito.", details: { token: "synthetic-secret" } }); });
  app.get("/unexpected/:id", () => { throw new Error("Technical person@example.com token=synthetic-secret"); });
  app.use(bodyParserErrorHandler);
  app.use(notFoundHandler);
  app.use(createErrorHandler(context));
  return app;
}

test("HTTP middleware generates an internal UUID and logs one completed summary", async () => {
  const logger = new CapturingLogger();
  await withServer(createApp({ logger }), async (url) => {
    const response = await fetch(`${url}/health?token=synthetic-secret`, { headers: { "x-request-id": "client-controlled" } });
    assert.equal(response.status, 200);
  });
  assert.equal(logger.logs.length, 1);
  assert.equal(logger.logs[0]?.level, "info");
  assert.equal(logger.logs[0]?.input.event, "http.request.completed");
  assert.match(logger.logs[0]?.input.requestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(logger.logs[0]?.input.requestId, "client-controlled");
  assert.deepEqual(logger.logs[0]?.input.http, { method: "GET", route: "/health", statusCode: 200 });
  assert.equal(JSON.stringify(logger.logs).includes("synthetic-secret"), false);
});

test("aliases use their first registered pattern and unmatched routes hide concrete paths and queries", async () => {
  const logger = new CapturingLogger();
  await withServer(fixtureApp(logger), async (url) => {
    assert.equal((await fetch(`${url}/alias-b?private=value`)).status, 200);
    assert.equal((await fetch(`${url}/private/concrete-id?private=value`)).status, 404);
  });
  const summaries = logger.logs.filter(({ input }) => input.event === "http.request.completed");
  assert.equal(summaries[0]?.input.http?.route, "/alias-a");
  assert.equal(summaries[1]?.input.http?.route, "unmatched");
  assert.equal(JSON.stringify(summaries).includes("concrete-id"), false);
  assert.equal(JSON.stringify(summaries).includes("private=value"), false);
});

test("expected and unexpected failures log one diagnostic plus one summary at centralized levels", async () => {
  const logger = new CapturingLogger();
  await withServer(fixtureApp(logger), async (url) => {
    const expected = await fetch(`${url}/expected/concrete-id`);
    assert.equal(expected.status, 409);
    assert.deepEqual(await expected.json(), { status: 409, message: "Estado em conflito." });
    const unexpected = await fetch(`${url}/unexpected/concrete-id`);
    assert.equal(unexpected.status, 500);
    assert.deepEqual(await unexpected.json(), { status: 500, message: "Erro interno do servidor." });
  });
  const failed = logger.logs.filter(({ input }) => input.event === "http.request.failed");
  const completed = logger.logs.filter(({ input }) => input.event === "http.request.completed");
  assert.equal(failed.length, 2);
  assert.equal(completed.length, 2);
  assert.deepEqual(failed.map(({ level }) => level), ["warn", "error"]);
  assert.deepEqual(completed.map(({ level }) => level), ["warn", "error"]);
  assert.equal(Object.hasOwn(completed[0]?.input ?? {}, "error"), false);
  assert.equal(failed[0]?.input.requestId, completed[0]?.input.requestId);
  assert.equal(failed[1]?.input.requestId, completed[1]?.input.requestId);
});

test("malformed JSON is normalized before logging and does not expose the submitted body", async () => {
  const logger = new CapturingLogger();
  await withServer(createApp({ logger }), async (url) => {
    const response = await fetch(`${url}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"privateNote":"unique-body-fragment",',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: 400, message: "JSON inválido." });
  });
  const failed = logger.logs.find(({ input }) => input.event === "http.request.failed");
  assert.ok(failed?.input.error instanceof AppError);
  assert.equal(JSON.stringify(logger.logs).includes("unique-body-fragment"), false);
});

test("close before finish produces one aborted warning and no completed event", () => {
  const logger = new CapturingLogger();
  const context = new LogContext(logger);
  const middleware = createRequestLoggingMiddleware(context);
  const response = Object.assign(new EventEmitter(), { locals: {}, statusCode: 200 }) as unknown as Response;
  const request = { method: "GET", baseUrl: "", route: { path: "/items/:id" } } as unknown as Request;
  middleware(request, response, (() => undefined) as NextFunction);
  response.emit("close");
  response.emit("finish");
  assert.equal(logger.logs.length, 1);
  assert.equal(logger.logs[0]?.level, "warn");
  assert.equal(logger.logs[0]?.input.event, "http.request.aborted");
});

test("route resolver never falls back to originalUrl", () => {
  const request = { method: "GET", baseUrl: "", originalUrl: "/private/id?token=value" } as Request;
  assert.equal(resolveRoutePattern(request), "unmatched");
});

test("nested router prefixes replace concrete dynamic segments", async () => {
  const logger = new CapturingLogger();
  const context = new LogContext(logger);
  const app = express();
  const router = express.Router({ mergeParams: true });
  app.use(createRequestLoggingMiddleware(context));
  router.get("/transactions/:id", (_request, response) => response.status(200).end());
  app.use("/accounts/:accountId", router);
  await withServer(app, async (url) => {
    assert.equal((await fetch(`${url}/accounts/private-account-id/transactions/private-transaction-id`)).status, 200);
  });
  assert.equal(logger.logs[0]?.input.http?.route, "/accounts/:segment/transactions/:id");
  assert.equal(JSON.stringify(logger.logs).includes("private-account-id"), false);
  assert.equal(JSON.stringify(logger.logs).includes("private-transaction-id"), false);
});

test("terminal handler destroys a started response without forwarding raw errors", () => {
  const error = new Error("RAW_SENTINEL token=synthetic-secret");
  let destroyed = false;
  let forwarded = false;
  const response = {
    headersSent: true,
    destroy() { destroyed = true; },
  } as unknown as Response;
  terminateStartedResponse(error, {} as Request, response, (() => { forwarded = true; }) as NextFunction);
  assert.equal(destroyed, true);
  assert.equal(forwarded, false);
});

test("production adapter serializes sanitized HTTP diagnostics without changing the response", async () => {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) { output += chunk.toString(); callback(); },
  });
  const logger = createPinoAppLogger({ environment: { NODE_ENV: "production" }, destination });
  await withServer(fixtureApp(logger), async (url) => {
    const response = await fetch(`${url}/unexpected/concrete-id`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { status: 500, message: "Erro interno do servidor." });
    const malformed = await fetch(`${url}/unexpected/concrete-id`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"privateNote":"unique-parser-body",',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { status: 400, message: "JSON inválido." });
  });
  const records = output.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const failed = records.find((record) => record.event === "http.request.failed" && (record.http as Record<string, unknown>).statusCode === 500);
  const parserFailure = records.find((record) => record.event === "http.request.failed" && (record.http as Record<string, unknown>).statusCode === 400);
  const completed = records.find((record) => record.event === "http.request.completed");
  assert.equal(failed?.level, "error");
  assert.equal((failed?.error as Record<string, unknown>).code, "INTERNAL_ERROR");
  assert.equal((failed?.error as Record<string, unknown>).status, 500);
  assert.equal(JSON.stringify(failed).includes("synthetic-secret"), false);
  assert.equal(JSON.stringify(failed).includes("person@example.com"), false);
  assert.equal(JSON.stringify(parserFailure).includes("unique-parser-body"), false);
  assert.equal((parserFailure?.error as Record<string, unknown>).message, "JSON inválido.");
  assert.equal(Object.hasOwn(completed ?? {}, "error"), false);
});
