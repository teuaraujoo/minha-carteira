import { AppError, ErrorCode } from "./app-error.js";
import type { PaginationInput } from "../../application/contracts/pagination.contract.js";
import type { PaginationMeta } from "../../application/contracts/pagination.contract.js";

export type { PaginationInput, PaginationMeta } from "../../application/contracts/pagination.contract.js";

const MAX_PAGE_SIZE = 100;

function invalidPagination(): AppError {
  return new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Paginação inválida" });
}

function parsePositiveInteger(value: unknown, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== "number" && (typeof value !== "string" || !/^[1-9]\d*$/.test(value))) {
    throw invalidPagination();
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw invalidPagination();
  return parsed;
}

export function parsePagination(query: { page?: unknown; pageSize?: unknown }): PaginationInput {
  const page = parsePositiveInteger(query.page, 1);
  const pageSize = parsePositiveInteger(query.pageSize, 20);
  const offset = (page - 1) * pageSize;
  if (pageSize > MAX_PAGE_SIZE || !Number.isSafeInteger(offset)) throw invalidPagination();
  return { page, pageSize, offset };
}

export function createPaginationMeta(input: PaginationInput, total: number): PaginationMeta {
  if (
    !Number.isSafeInteger(input.page) || input.page <= 0 ||
    !Number.isSafeInteger(input.pageSize) || input.pageSize <= 0 || input.pageSize > MAX_PAGE_SIZE ||
    !Number.isSafeInteger(input.offset) || input.offset !== (input.page - 1) * input.pageSize ||
    !Number.isSafeInteger(total) || total < 0
  ) {
    throw new RangeError("Estado interno de paginação inválido.");
  }
  return { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) };
}
