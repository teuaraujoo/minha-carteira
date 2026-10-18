import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

async function runServer(mode = "invalid-log-level"): Promise<{ code: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const args = ["node_modules/tsx/dist/cli.mjs", "--import", "./test/logging/fixtures/server-bootstrap.mjs"];
    args.push("src/server.ts");
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: "verbose", NODE_ENV: "production", SERVER_TEST_MODE: mode ?? "", PORT: "4321" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("O servidor não encerrou no prazo esperado.")); }, 10_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("close", (code) => { clearTimeout(timeout); resolve({ code, stderr, stdout }); });
  });
}

function records(output: string): Record<string, unknown>[] {
  return output.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("confirmed startup logs the port and repeated shutdown signals close resources once", async () => {
  const result = await runServer("shutdown");
  assert.equal(result.code, 0, result.stderr);
  const logs = records(result.stdout);
  const started = logs.find((record) => record.event === "server.started");
  assert.equal(started?.level, "info");
  assert.equal(Object.hasOwn(started ?? {}, "requestId"), false);
  assert.match(String(started?.message), /4321/);
  assert.equal(logs.filter((record) => record.event === "test.server.closed").length, 1);
  assert.equal(logs.filter((record) => record.event === "test.logger.closed").length, 1);
});

test("startup server errors emit fatal and close the logger", async () => {
  const result = await runServer("error");
  assert.equal(result.code, 1, result.stderr);
  const logs = records(result.stdout);
  const failed = logs.find((record) => record.event === "server.failed");
  assert.equal(failed?.level, "fatal");
  assert.equal((failed?.error as Record<string, unknown>).message, "Falha simulada ao iniciar");
  assert.equal(Object.hasOwn(failed ?? {}, "requestId"), false);
  assert.equal(logs.filter((record) => record.event === "test.logger.closed").length, 1);
});

test("invalid LOG_LEVEL emits one sanitized server.failed NDJSON record without a raw stack", async () => {
  const result = await runServer();
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  const logs = records(result.stderr);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.event, "server.failed");
  assert.equal(logs[0]?.level, "fatal");
  assert.equal(logs[0]?.message, "Falha ao configurar o servidor");
  assert.equal((logs[0]?.error as Record<string, unknown>).stack, "[Pilha indisponível]");
});
