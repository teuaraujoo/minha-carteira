import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import type { Express } from "express";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import { startServer } from "../../src/app/start-server.js";

interface CapturedLog {
  level: string;
  input: LogInput;
}

class CapturingLogger implements AppLogger {
  readonly logs: CapturedLog[] = [];
  closeCalls = 0;
  debug(input: LogInput): void { this.logs.push({ level: "debug", input }); }
  info(input: LogInput): void { this.logs.push({ level: "info", input }); }
  warn(input: LogInput): void { this.logs.push({ level: "warn", input }); }
  error(input: LogInput): void { this.logs.push({ level: "error", input }); }
  fatal(input: LogInput): void { this.logs.push({ level: "fatal", input }); }
  async close(): Promise<void> { this.closeCalls++; }
}

test("confirmed startup emits server.started without a requestId and shutdown closes once", async () => {
  const logger = new CapturingLogger();
  const started = startServer(express(), logger, 0);
  await new Promise<void>((resolve, reject) => {
    if (started.server.listening) resolve();
    else { started.server.once("listening", resolve); started.server.once("error", reject); }
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(logger.logs[0]?.level, "info");
  assert.equal(logger.logs[0]?.input.event, "server.started");
  assert.equal(Object.hasOwn(logger.logs[0]?.input ?? {}, "requestId"), false);
  const first = started.shutdown();
  const second = started.shutdown();
  assert.strictEqual(first, second);
  await first;
  assert.equal(logger.closeCalls, 1);
});

test("startup server errors emit fatal without a requestId", async () => {
  const startupError = new Error("synthetic listen failure");
  const fakeServer = Object.assign(new EventEmitter(), {
    close(callback?: () => void) { callback?.(); return fakeServer; },
  }) as unknown as Server;
  const app = {
    listen(_port: string | number, _callback: () => void) {
      queueMicrotask(() => fakeServer.emit("error", startupError));
      return fakeServer;
    },
  } as unknown as Express;
  const logger = new CapturingLogger();
  const previousExitCode = process.exitCode;
  const started = startServer(app, logger, 3000);
  await new Promise<void>((resolve) => started.server.once("error", () => resolve()));
  assert.equal(logger.logs[0]?.level, "fatal");
  assert.equal(logger.logs[0]?.input.event, "server.failed");
  assert.strictEqual(logger.logs[0]?.input.error, startupError);
  assert.equal(Object.hasOwn(logger.logs[0]?.input ?? {}, "requestId"), false);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(logger.closeCalls, 1);
  process.exitCode = previousExitCode;
});

test("invalid LOG_LEVEL emits one sanitized server.failed NDJSON record without a raw stack", async () => {
  const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/server.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: "verbose", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr, stdout }));
  });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  const records = result.stderr.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.event, "server.failed");
  assert.equal(records[0]?.level, "fatal");
  assert.equal(records[0]?.message, "Falha ao configurar o servidor");
  assert.equal((records[0]?.error as Record<string, unknown>).stack, "[Pilha indisponível]");
});
