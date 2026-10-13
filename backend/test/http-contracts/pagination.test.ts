import assert from "node:assert/strict";
import test from "node:test";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { serializeError } from "../../src/shared/presentation/http/error-response.js";
import { createPaginationMeta, parsePagination } from "../../src/shared/presentation/http/pagination.js";

test("pagination applies defaults only to undefined", () => {
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 20, offset: 0 });
  assert.deepEqual(parsePagination({ page: undefined, pageSize: undefined }), { page: 1, pageSize: 20, offset: 0 });
});

test("pagination accepts safe positive decimal strings and integers up to the page size limit", () => {
  assert.deepEqual(parsePagination({ page: "2", pageSize: "100" }), { page: 2, pageSize: 100, offset: 100 });
  assert.deepEqual(parsePagination({ page: 2, pageSize: 20 }), { page: 2, pageSize: 20, offset: 20 });
  assert.deepEqual(parsePagination({ page: Number.MAX_SAFE_INTEGER, pageSize: 1 }), {
    page: Number.MAX_SAFE_INTEGER, pageSize: 1, offset: Number.MAX_SAFE_INTEGER - 1,
  });
});

const invalidValues: unknown[] = [null, true, false, [], ["1", "2"], {}, "", 0, -1, 1.5, NaN, Infinity,
  Number.MAX_SAFE_INTEGER + 1, "0", "-1", "01", "+1", "1.0", "1e2", " 1", "1 ", "1\n", "9007199254740992"];

for (const field of ["page", "pageSize"] as const) {
  for (const [index, value] of invalidValues.entries()) {
    test(`pagination rejects invalid ${field} case ${index + 1}`, () => {
      assert.throws(() => parsePagination({ [field]: value }), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.status, 400);
        assert.equal(error.code, ErrorCode.VALIDATION_ERROR);
        assert.equal(error.message, "Paginação inválida");
        return true;
      });
    });
  }
}

test("pageSize 101 and query offset overflow are client errors", () => {
  assert.throws(() => parsePagination({ pageSize: 101 }), AppError);
  assert.throws(() => parsePagination({ page: Number.MAX_SAFE_INTEGER, pageSize: 2 }), AppError);
});

test("metadata preserves the requested page even when empty or beyond the end", () => {
  assert.deepEqual(createPaginationMeta(parsePagination({ page: 8 }), 0), { page: 8, pageSize: 20, total: 0, totalPages: 0 });
  assert.deepEqual(createPaginationMeta(parsePagination({ page: 8 }), 21), { page: 8, pageSize: 20, total: 21, totalPages: 2 });
  assert.deepEqual(createPaginationMeta(parsePagination({}), Number.MAX_SAFE_INTEGER), {
    page: 1, pageSize: 20, total: Number.MAX_SAFE_INTEGER, totalPages: Math.ceil(Number.MAX_SAFE_INTEGER / 20),
  });
});

test("invalid totals and inconsistent internal inputs are RangeErrors serialized as 500", () => {
  for (const total of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "21", null]) {
    assert.throws(() => createPaginationMeta(parsePagination({}), total as number), RangeError);
  }
  for (const input of [
    { page: 2, pageSize: 20, offset: 0 },
    { page: 0, pageSize: 20, offset: -20 },
    { page: 1, pageSize: 101, offset: 0 },
    { page: Number.MAX_SAFE_INTEGER, pageSize: 2, offset: (Number.MAX_SAFE_INTEGER - 1) * 2 },
  ]) {
    assert.throws(() => createPaginationMeta(input, 21), (error: unknown) => {
      assert.ok(error instanceof RangeError);
      assert.deepEqual(serializeError(error, { environment: "production" }), { status: 500, message: "Erro interno do servidor." });
      return true;
    });
  }
});
