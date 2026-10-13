import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import {
  createLogErrorDiagnostic,
  sanitizeLogContext,
  sanitizeLogText,
  sanitizeLogValue,
} from "../../src/shared/infrastructure/logging/log-sanitizer.js";

test("text sanitization removes approved sensitive patterns without truncating the message", () => {
  const largeSuffix = "x".repeat(100_000);
  const source = [
    "person@example.com",
    "Bearer synthetic-secret",
    "https://user:pass@example.com/private?token=value",
    "postgresql://user:pass@localhost:5432/wallet",
    "redis://:pass@localhost:6379",
    "mongodb://user:pass@localhost/wallet",
    "eyJaaaaaaaaaa.bbbbbbbbbb.cccccccccc",
    "a".repeat(32),
    "SELECT * FROM users WHERE email = 'person@example.com'",
    "/auth/reset-password?token=synthetic-secret",
    largeSuffix,
  ].join(" | ");
  const sanitized = sanitizeLogText(source);
  for (const secret of ["person@example.com", "synthetic-secret", "user:pass", "SELECT *", "/auth/reset-password", "a".repeat(32)]) {
    assert.equal(sanitized.includes(secret), false);
  }
  assert.equal(sanitized.endsWith(largeSuffix), true);
  assert.equal(sanitized.includes("[URL REMOVIDA]"), true);
  assert.equal(sanitized.includes("[SQL REMOVIDO]"), true);
});

test("iterative sanitizer handles deep data, cycles, repeated references and non-JSON values", () => {
  const repeated = { value: "safe" };
  const root: Record<string, unknown> = { repeated, second: repeated, missing: undefined, invalid: Infinity, big: 12n };
  root.self = root;
  let cursor = root;
  for (let index = 0; index < 1_500; index++) {
    const child: Record<string, unknown> = {};
    cursor.child = child;
    cursor = child;
  }
  cursor.end = "preserved";
  const sanitized = sanitizeLogValue(root) as Record<string, unknown>;
  assert.equal(sanitized.self, "[Circular]");
  assert.equal(sanitized.second, "[Circular]");
  assert.equal(sanitized.missing, null);
  assert.equal(sanitized.invalid, null);
  assert.equal(sanitized.big, "12");
  let sanitizedCursor = sanitized;
  for (let index = 0; index < 1_500; index++) sanitizedCursor = sanitizedCursor.child as Record<string, unknown>;
  assert.equal(sanitizedCursor.end, "preserved");
});

test("sanitizer never executes getters and masks sensitive keys in nested errors", () => {
  let getterCalls = 0;
  const source = Object.defineProperties({}, {
    safe: { enumerable: true, value: "value" },
    token: { enumerable: true, value: "synthetic-secret" },
    dangerous: { enumerable: true, get() { getterCalls++; throw new Error("must not run"); } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(sanitizeLogValue(source))), {
    safe: "value",
    token: "[REMOVIDO]",
    dangerous: "[Acessor]",
  });
  assert.equal(getterCalls, 0);
});

test("error diagnostics distinguish AppError, unexpected Error and non-Error throws", () => {
  const appError = createLogErrorDiagnostic(new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "JSON inválido.", details: undefined }));
  assert.equal(appError.name, "AppError");
  assert.equal(appError.code, "VALIDATION_ERROR");
  assert.equal(appError.status, 400);
  assert.equal(appError.details, null);

  const unexpected = createLogErrorDiagnostic(new Error("technical token=synthetic-secret", { cause: new Error("person@example.com") }));
  assert.equal(unexpected.code, "INTERNAL_ERROR");
  assert.equal(unexpected.status, 500);
  assert.equal(JSON.stringify(unexpected).includes("synthetic-secret"), false);
  assert.equal(JSON.stringify(unexpected).includes("person@example.com"), false);

  const thrown = createLogErrorDiagnostic({ password: "synthetic-secret", reason: "plain object" });
  assert.equal(thrown.name, "NonErrorThrown");
  assert.equal(thrown.stack, "[Pilha indisponível]");
  assert.deepEqual(JSON.parse(JSON.stringify(thrown.details)), { password: "[REMOVIDO]", reason: "plain object" });
});

test("context accepts only own allowlisted strings and finite numbers", () => {
  const inherited = { userId: "inherited-user" };
  const context = Object.assign(Object.create(inherited), {
    operation: "list",
    count: 3,
    accountId: "account-id",
    email: "person@example.com",
    amount: 999,
  });
  Object.defineProperty(context, "transactionId", { enumerable: true, get() { throw new Error("must not run"); } });
  assert.deepEqual(JSON.parse(JSON.stringify(sanitizeLogContext(context))), {
    operation: "list",
    count: 3,
    accountId: "account-id",
  });
});

test("error diagnostics never execute getters and unexpected errors always use INTERNAL_ERROR 500", () => {
  let getterCalls = 0;
  const error = new Error("safe");
  Object.defineProperties(error, {
    name: { configurable: true, get() { getterCalls++; throw new Error("must not run"); } },
    message: { configurable: true, get() { getterCalls++; throw new Error("must not run"); } },
    stack: { configurable: true, get() { getterCalls++; throw new Error("must not run"); } },
    code: { enumerable: true, value: "ENOENT" },
    status: { enumerable: true, value: 404 },
  });
  const diagnostic = createLogErrorDiagnostic(error);
  assert.equal(getterCalls, 0);
  assert.equal(diagnostic.code, "INTERNAL_ERROR");
  assert.equal(diagnostic.status, 500);
  assert.equal(diagnostic.message, "[Acessor]");
  assert.equal(diagnostic.stack, "[Pilha indisponível]");
});
