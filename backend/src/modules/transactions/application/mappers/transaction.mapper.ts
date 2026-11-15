import { Transaction } from "../../domain/entities/transaction.entity.js";
import type { TransactionStatus, TransactionType } from "../../domain/enums/transaction.enums.js";
import type { TransactionResponseDto } from "../dto/transaction.dto.js";

export interface TransactionRecord {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: unknown;
  type: string;
  status: string;
  transactionDate: Date | string;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Converte registros Prisma para a entidade Transaction e desta para DTO HTTP. */
export class TransactionMapper {
  static toEntity(record: TransactionRecord): Transaction {
    return new Transaction({
      id: record.id,
      userId: record.userId,
      accountId: record.accountId,
      categoryId: record.categoryId,
      description: record.description,
      amount: decimalToPositiveNumber(record.amount),
      type: record.type as TransactionType,
      status: record.status as TransactionStatus,
      transactionDate: toCivilDateString(record.transactionDate),
      notes: record.notes,
      confirmedAt: record.confirmedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toDto(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      transactionDate: transaction.transactionDate,
      notes: transaction.notes,
      confirmedAt: transaction.confirmedAt ? transaction.confirmedAt.toISOString() : null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}

export const toTransactionResponseDto = TransactionMapper.toDto;

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  }
  const numeric = Number(String(value));
  if (!Number.isFinite(numeric)) {
    throw new RangeError("Valor decimal inválido retornado pelo banco de dados.");
  }
  return Number(numeric.toFixed(2));
}

function decimalToPositiveNumber(value: unknown): number {
  const numeric = Number(String(value));
  if (!Number.isFinite(numeric)) {
    throw new RangeError("Valor decimal inválido retornado pelo banco de dados.");
  }
  return Number(numeric.toFixed(2));
}

function toCivilDateString(value: Date | string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Data inválida retornada pelo banco de dados.");
    }
    return value.toISOString().slice(0, 10);
  }
  return value.trim().slice(0, 10);
}
