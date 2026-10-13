import assert from "node:assert/strict";
import test from "node:test";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import { LogContext } from "../../src/shared/infrastructure/logging/log-context.js";

class CapturingLogger implements AppLogger {
  readonly inputs: LogInput[] = [];
  debug(input: LogInput): void { this.inputs.push(input); }
  info(input: LogInput): void { this.inputs.push(input); }
  warn(input: LogInput): void { this.inputs.push(input); }
  error(input: LogInput): void { this.inputs.push(input); }
  fatal(input: LogInput): void { this.inputs.push(input); }
  async close(): Promise<void> {}
}

const event = { event: "server.started" as const, module: "server" as const, message: "Evento" };

test("request context survives nested awaits and isolates concurrent requests", async () => {
  const base = new CapturingLogger();
  const context = new LogContext(base);
  await Promise.all([
    context.runWithRequest("request-a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 8));
      context.logger().info(event);
    }),
    context.runWithRequest("request-b", async () => {
      await Promise.resolve();
      context.logger().info(event);
    }),
  ]);
  assert.deepEqual(base.inputs.map((input) => input.requestId).sort(), ["request-a", "request-b"]);
});

test("bound logger overrides caller requestId and late callbacks fall back to base", async () => {
  const base = new CapturingLogger();
  const context = new LogContext(base);
  await new Promise<void>((resolve) => {
    context.runWithRequest("internal-id", (deactivate) => {
      context.logger().info({ ...event, requestId: "client-controlled" });
      deactivate();
      setTimeout(() => {
        context.logger().info(event);
        resolve();
      }, 0);
    });
  });
  assert.equal(base.inputs[0]?.requestId, "internal-id");
  assert.equal(Object.hasOwn(base.inputs[1] ?? {}, "requestId"), false);
});

test("execution outside HTTP uses the base logger without a fabricated requestId", () => {
  const base = new CapturingLogger();
  const context = new LogContext(base);
  context.logger().info(event);
  assert.equal(Object.hasOwn(base.inputs[0] ?? {}, "requestId"), false);
});

test("binding a requestId does not execute input getters or interrupt the caller", () => {
  let getterCalls = 0;
  const context = new LogContext({
    debug() {}, info() {}, warn() {}, error() {}, fatal() {}, async close() {},
  });
  const hostileInput = Object.defineProperty({}, "message", {
    enumerable: true,
    get() { getterCalls++; throw new Error("getter escaped"); },
  }) as LogInput;
  assert.doesNotThrow(() => context.runWithRequest("internal-id", () => context.logger().info(hostileInput)));
  assert.equal(getterCalls, 0);
});
