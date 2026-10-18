import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { Router } from "express";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import type { Express, NextFunction, Request, Response } from "express";
import { createApp } from "../../src/app/app.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { bodyParserErrorHandler, errorHandler, JSON_BODY_LIMIT, notFoundHandler } from "../../src/shared/presentation/middlewares/error-middleware.js";
import { createPaginationMeta, parsePagination } from "../../src/shared/presentation/http/pagination.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../src/shared/presentation/http/success-response.js";

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

function fixtureApp(): Express {
  const app = express();
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.get("/api/v1/result", (_request, response) => sendSuccess(response, { message: "Operação concluída." }));
  app.post("/api/v1/result", (_request, response) => sendCreated(response, { id: "example", currency: "BRL" }));
  app.delete("/api/v1/result", (_request, response) => sendNoContent(response));
  app.get("/api/v1/list", (request, response) => {
    const input = parsePagination(request.query);
    sendSuccess(response, [], createPaginationMeta(input, 21));
  });
  app.get("/api/v1/internal-pagination", (_request, response) => {
    sendSuccess(response, [], createPaginationMeta({ page: 2, pageSize: 20, offset: 0 }, 21));
  });
  app.get("/api/v1/failure", () => { throw { status: 401, message: "synthetic private failure" }; });
  app.get("/api/v1/expected", () => { throw new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "Estado em conflito." }); });
  app.use(bodyParserErrorHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

test("real HTTP consumer reads data/meta and treats 204 as an empty response", async () => {
  await withServer(fixtureApp(), async (url) => {
    const queried = await fetch(`${url}/api/v1/result`);
    assert.equal(queried.status, 200);
    const queriedBody = await queried.json();
    assert.deepEqual(queriedBody, { data: { message: "Operação concluída." } });
    assert.equal(queriedBody.data.message, "Operação concluída.");
    const created = await fetch(`${url}/api/v1/result`, { method: "POST" });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { data: { id: "example", currency: "BRL" } });
    const removed = await fetch(`${url}/api/v1/result`, { method: "DELETE" });
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), "");
    const listed = await fetch(`${url}/api/v1/list?page=8&pageSize=20`);
    assert.equal(listed.status, 200);
    assert.deepEqual(await listed.json(), { data: [], meta: { page: 8, pageSize: 20, total: 21, totalPages: 2 } });
  });
});

test("real HTTP rejects repeated, malformed and overflowing pagination and internal inconsistency", async () => {
  await withServer(fixtureApp(), async (url) => {
    for (const query of ["page=1&page=2", "pageSize=101", "page=01", "page=1e2", "page=%201", "page=1.0", "page=9007199254740991&pageSize=2"]) {
      const response = await fetch(`${url}/api/v1/list?${query}`);
      const body = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.status, 400);
      assert.equal(body.message, "Paginação inválida");
      assert.equal(Object.hasOwn(body, "data"), false);
    }
    const response = await fetch(`${url}/api/v1/internal-pagination`);
    assert.equal(response.status, 500);
    assert.equal((await response.json()).message, "Erro interno do servidor.");
  });
});

test("createApp keeps infrastructure endpoints intact and integrates 400/413/404 after routes", async () => {
  await withServer(createApp({ logger: noopLogger, authRouter: Router(), usersRouter: Router(), allowedOrigins: [] }), async (url) => {
    assert.equal(await (await fetch(url)).text(), "Hello, World!");
    assert.deepEqual(await (await fetch(`${url}/health`)).json(), { status: "ok" });
    const missing = await fetch(`${url}/api/v1/missing`);
    assert.equal(missing.status, 404);
    const missingBody = await missing.json();
    assert.equal(missingBody.status, 404);
    assert.equal(missingBody.message, "Recurso não encontrado.");
    assert.equal(Object.hasOwn(missingBody, "data"), false);
    const malformed = await fetch(`${url}/api/v1/missing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"field":' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, "JSON inválido.");
    const oversized = await fetch(`${url}/api/v1/missing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field: "x".repeat(102401) }) });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).message, "Corpo da requisição excede o limite permitido.");
  });
});

test("HTTP expected and unknown errors use their status, never a success envelope", async () => {
  await withServer(fixtureApp(), async (url) => {
    for (const [path, status, message] of [["expected", 409, "Estado em conflito."], ["failure", 500, "Erro interno do servidor."]] as const) {
      const response = await fetch(`${url}/api/v1/${path}`);
      const body = await response.json();
      assert.equal(response.status, status);
      assert.equal(body.status, status);
      assert.equal(body.message, message);
      assert.equal(Object.hasOwn(body, "data"), false);
    }
  });
});

test("headersSent forwards the original failure without status/json calls", () => {
  const error = new Error("Synthetic failure");
  const response = {
    headersSent: true,
    status() { assert.fail("must not write status"); },
    json() { assert.fail("must not write JSON"); },
  } as unknown as Response;
  let forwarded: unknown;
  errorHandler(error, {} as Request, response, ((received: unknown) => { forwarded = received; }) as NextFunction);
  assert.strictEqual(forwarded, error);
});

test("real HTTP already-started response is forwarded without an additional JSON body", async () => {
  const app = express();
  let forwarded = false;
  app.get("/partial", (_request, response, next) => {
    response.status(200).write("partial");
    next(new Error("Synthetic failure"));
  });
  app.use(errorHandler);
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    assert.ok(error instanceof Error);
    forwarded = true;
    response.end();
  });
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/partial`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "partial");
    assert.equal(forwarded, true);
  });
});
