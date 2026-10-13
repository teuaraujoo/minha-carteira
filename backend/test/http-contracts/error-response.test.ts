import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { serializeError } from "../../src/shared/presentation/http/error-response.js";
import { sanitizeDiagnostic, sanitizeText } from "../../src/shared/presentation/http/sanitize-diagnostic.js";

test("AppError validates status, code and non-empty message and preserves stack and cause", () => {
  const cause = new Error("Synthetic failure");
  const error = new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Campo inválido.", cause, details: { field: "email" } });
  assert.ok(error instanceof Error);
  assert.strictEqual(error.cause, cause);
  assert.match(error.stack!, /AppError: Campo inválido/);
  assert.deepEqual(error.details, { field: "email" });
  for (const status of [399, 600, 400.5, NaN, Infinity, "400"]) {
    assert.throws(() => new AppError({ status: status as number, code: ErrorCode.VALIDATION_ERROR, message: "Campo inválido." }), RangeError);
  }
  for (const code of ["OTHER", undefined, null]) {
    assert.throws(() => new AppError({ status: 400, code: code as ErrorCode, message: "Campo inválido." }), TypeError);
  }
  for (const message of ["", "  ", null, undefined, 3]) {
    assert.throws(() => new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: message as string }), TypeError);
  }
});

for (const environment of ["production", "staging", "preview", "", "Development", "TEST"]) {
  test(`environment ${JSON.stringify(environment)} returns only public status and message`, () => {
    const error = new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "Estado em conflito.", details: { field: "status" }, cause: new Error("internal") });
    assert.deepEqual(serializeError(error, { environment, requestId: "synthetic-request" }), { status: 409, message: "Estado em conflito." });
  });
}

test("absent NODE_ENV uses the restricted response", () => {
  const previous = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    assert.deepEqual(serializeError(new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Recurso não encontrado." })), {
      status: 404, message: "Recurso não encontrado.",
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

for (const environment of ["development", "test"]) {
  test(`${environment} exposes available sanitized diagnostics and omits cause/name`, () => {
    const error = new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Campo inválido. token=synthetic-value", details: { field: "email", password: "synthetic-value" }, cause: new Error("secret=synthetic-value") });
    const body = serializeError(error, { environment, requestId: "Bearer synthetic-value" });
    assert.equal(body.code, ErrorCode.VALIDATION_ERROR);
    assert.equal(body.message, "Campo inválido. token=[REMOVIDO]");
    assert.deepEqual(JSON.parse(JSON.stringify(body.details)), { field: "email", password: "[REMOVIDO]" });
    assert.equal(body.requestId, "Bearer [REMOVIDO]");
    assert.ok(body.stack?.includes("token=[REMOVIDO]"));
    assert.equal(JSON.stringify(body).includes("synthetic-value"), false);
    assert.equal(Object.hasOwn(body, "cause"), false);
    assert.equal(Object.hasOwn(body, "name"), false);
    const minimal = serializeError(new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Campo inválido." }), { environment });
    assert.equal(Object.hasOwn(minimal, "requestId"), false);
    assert.equal(Object.hasOwn(minimal, "details"), false);
  });
}

test("unknown thrown values always return generic 500 and never trust status or message", () => {
  for (const error of [new Error("synthetic internal error"), { status: 401, message: "private", code: "UNAUTHORIZED" }, "private", null, undefined, 7]) {
    assert.deepEqual(serializeError(error, { environment: "production" }), { status: 500, message: "Erro interno do servidor." });
    assert.equal(serializeError(error, { environment: "test" }).code, ErrorCode.INTERNAL_ERROR);
  }
});

test("sanitization masks all sensitive keys case-insensitively, including arrays and Error causes", () => {
  const keys = ["password", "PASSWD", "Secret", "token", "accessToken", "RefreshToken", "AUTHORIZATION", "cookie", "Set-Cookie", "credential", "apiKey", "API_KEY", "api-key"];
  const source = Object.fromEntries(keys.map((key) => [key, "synthetic-value"]));
  const sanitized = sanitizeDiagnostic({ nested: [source], error: new Error("token=synthetic-value", { cause: { password: "synthetic-value" } }) });
  const encoded = JSON.stringify(sanitized);
  assert.equal(encoded.includes("synthetic-value"), false);
  const plain = JSON.parse(encoded);
  for (const key of keys) assert.equal(plain.nested[0][key], "[REMOVIDO]");
  assert.equal(plain.error.cause.password, "[REMOVIDO]");
  assert.equal(plain.error.message, "token=[REMOVIDO]");
});

test("text sanitization masks Bearer, HTTP/PostgreSQL URL credentials and quoted/text assignments", () => {
  for (const text of [
    "Bearer synthetic-value", "bearer synthetic-value",
    "https://synthetic-user:synthetic-value@example.invalid/path",
    "http://synthetic-user:synthetic-value@example.invalid/path",
    "postgresql://synthetic-user:synthetic-value@example.invalid/db",
    "postgres://synthetic-user:synthetic-value@example.invalid/db",
    'password="synthetic-value with spaces"', "passwd='synthetic-value'",
    '{"api_key":"synthetic-value"}', "Cookie: session=synthetic-value; other=synthetic-value",
    "Authorization: Bearer synthetic-value", "set-cookie: session=synthetic-value; HttpOnly",
    "refreshToken=synthetic-value", "api-key: synthetic-value",
    String.raw`password="prefix\"synthetic-value"`,
    "https://synthetic-user:prefix@synthetic-value@example.invalid/path",
  ]) {
    assert.equal(sanitizeText(text).includes("synthetic-value"), false);
    assert.ok(sanitizeText(text).includes("[REMOVIDO]"));
  }
});

test("all Cookie and Set-Cookie values are masked in text and public production messages", () => {
  for (const text of [
    "set-cookie: sid=synthetic-one; Path=/, csrf=synthetic-two; Path=/",
    "SET-COOKIE: sid=synthetic-one; Path=/, csrf=synthetic-two; Path=/",
    "Cookie: sid=synthetic-one; csrf=synthetic-two",
    "cookie=sid=synthetic-one, csrf=synthetic-two",
    'set-cookie: "sid=synthetic-one", "csrf=synthetic-two"',
    "set-cookie: sid=synthetic-one; Path=/\nset-cookie: csrf=synthetic-two; Path=/",
  ]) {
    const sanitized = sanitizeText(text);
    assert.equal(sanitized.includes("synthetic-one"), false);
    assert.equal(sanitized.includes("synthetic-two"), false);
    assert.ok(sanitized.includes("[REMOVIDO]"));
    const error = new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: text,
      details: { diagnostic: text }, cause: new Error(text) });
    for (const environment of ["production", "development", "test"]) {
      const body = serializeError(error, { environment, requestId: text });
      const encoded = JSON.stringify(body);
      assert.equal(encoded.includes("synthetic-one"), false);
      assert.equal(encoded.includes("synthetic-two"), false);
      assert.equal(body.status, 400);
      assert.ok(body.message.includes("[REMOVIDO]"));
      if (environment === "production") assert.deepEqual(Object.keys(body), ["status", "message"]);
    }
    const causeDiagnostic = JSON.stringify(sanitizeDiagnostic(error.cause));
    assert.equal(causeDiagnostic.includes("synthetic-one"), false);
    assert.equal(causeDiagnostic.includes("synthetic-two"), false);
  }
});

test("cycles, repeated references, getters, depth, undefined and non-JSON primitives remain serializable", () => {
  let getterCalls = 0;
  const repeated = { field: "email" };
  const source: Record<string, unknown> = { first: repeated, second: repeated, missing: undefined, big: 1n, invalid: NaN };
  source.self = source;
  Object.defineProperty(source, "getter", { enumerable: true, get() { getterCalls++; throw new Error("must not run"); } });
  const array = [1, 2];
  Object.defineProperty(array, "1", { get() { getterCalls++; throw new Error("must not run"); } });
  source.array = array;
  let deep: Record<string, unknown> = source;
  for (let index = 0; index < 12; index++) {
    const child: Record<string, unknown> = {};
    deep.deep = child;
    deep = child;
  }
  const sanitized = JSON.parse(JSON.stringify(sanitizeDiagnostic(source)));
  assert.equal(getterCalls, 0);
  assert.equal(sanitized.self, "[Circular]");
  assert.equal(sanitized.second, "[Circular]");
  assert.equal(sanitized.getter, "[Acessor]");
  assert.deepEqual(sanitized.array, [1, "[Acessor]"]);
  assert.equal(sanitized.missing, null);
  assert.equal(sanitized.big, "1");
  assert.equal(sanitized.invalid, null);
  assert.ok(JSON.stringify(sanitized).includes("[Limite de profundidade]"));
});

test("the serializer does not run accessors on unknown errors or AppError diagnostics", () => {
  let getterCalls = 0;
  const unknown = Object.defineProperties({}, {
    status: { get() { getterCalls++; return 401; } },
    message: { get() { getterCalls++; return "private"; } },
  });
  assert.equal(serializeError(unknown, { environment: "test" }).status, 500);
  const error = new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Campo inválido." });
  Object.defineProperty(error, "details", { get() { getterCalls++; return "private"; } });
  Object.defineProperty(error, "stack", { get() { getterCalls++; return "private"; } });
  assert.equal(Object.hasOwn(serializeError(error, { environment: "test" }), "details"), false);
  assert.equal(getterCalls, 0);
});
