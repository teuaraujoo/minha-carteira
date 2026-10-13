import assert from "node:assert/strict";
import test from "node:test";
import { createSuccessResponse } from "../../src/shared/presentation/http/success-response.js";

test("success envelopes preserve public data without adding root flags or converting DTO values", () => {
  const data = { id: "example", message: "Operação concluída.", amount: "1250.50" };
  assert.deepEqual(createSuccessResponse(data), { data });
  assert.strictEqual(createSuccessResponse(data).data, data);
  assert.deepEqual(createSuccessResponse([]), { data: [] });
  assert.deepEqual(createSuccessResponse(null), { data: null });
  assert.deepEqual(createSuccessResponse(0), { data: 0 });
});

test("metadata is omitted when absent and included directly when supplied", () => {
  assert.equal(Object.hasOwn(createSuccessResponse("result"), "meta"), false);
  assert.equal(Object.hasOwn(createSuccessResponse("result", undefined), "meta"), false);
  assert.deepEqual(createSuccessResponse([], { count: 0 }), { data: [], meta: { count: 0 } });
});

test("undefined data and wrapping an existing helper envelope are programming errors", () => {
  assert.throws(() => createSuccessResponse(undefined), TypeError);
  assert.throws(() => createSuccessResponse(createSuccessResponse({ id: "example" })), TypeError);
});
