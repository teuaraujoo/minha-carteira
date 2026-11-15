import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import {
  AccountStatus as PrismaAccountStatus,
  TransactionStatus as PrismaTransactionStatus,
  TransactionType as PrismaTransactionType,
} from "../../../../../generated/prisma/enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import {
  decimalToNumber,
  TransactionMapper,
  type TransactionRecord,
} from "../../application/mappers/transaction.mapper.js";
import { Transaction } from "../../domain/entities/transaction.entity.js";
import {
  TransactionSortBy,
  TransactionStatus,
  TransactionType,
} from "../../domain/enums/transaction.enums.js";
import type { ITransactionRepository } from "../../domain/interfaces/transaction-repository.interface.js";
import type {
  PaginatedTransactionsResult,
  TransactionPaginationQuery,
} from "../../domain/interfaces/transaction.interfaces.js";

export interface PrismaTransactionScope {
  transaction: Pick<
    PrismaClient["transaction"],
    "create" | "findFirst" | "updateMany" | "findUniqueOrThrow"
  >;
  account: Pick<PrismaClient["account"], "update">;
}

export interface PrismaTransactionClient {
  transaction: Pick<
    PrismaClient["transaction"],
    "create" | "findFirst" | "findMany" | "count" | "aggregate" | "updateMany" | "findUniqueOrThrow"
  >;
  account: Pick<PrismaClient["account"], "update">;
  $transaction<T>(fn: (tx: PrismaTransactionScope) => Promise<T>): Promise<T>;
}

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async create(transaction: Transaction): Promise<Transaction> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const record = await tx.transaction.create({
          data: {
            id: transaction.id,
            userId: transaction.userId,
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
            description: transaction.description,
            amount: transaction.amount.toFixed(2),
            type: PrismaTransactionType[transaction.type],
            status: PrismaTransactionStatus[transaction.status],
            transactionDate: civilDateToUtcDate(transaction.transactionDate),
            notes: transaction.notes,
            confirmedAt: transaction.confirmedAt,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
            deletedAt: transaction.deletedAt,
          },
        });

        // Somente transações confirmadas impactam o saldo atual de conta ativa do usuário.
        if (transaction.status === TransactionStatus.CONFIRMED) {
          await tx.account.update({
            where: {
              id: transaction.accountId,
              userId: transaction.userId,
              status: PrismaAccountStatus.ACTIVE,
            },
            data: {
              currentBalance: balanceAdjustmentFor(transaction.type, transaction.amount, "apply"),
              updatedAt: transaction.updatedAt,
            },
          });
        }

        return record;
      });

      return TransactionMapper.toEntity(created as TransactionRecord);
    } catch (error) {
      throw mapPrismaTransactionError(error);
    }
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Transaction | null> {
    const found = await this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });
    return found ? TransactionMapper.toEntity(found as TransactionRecord) : null;
  }

  async findManyByUserId(query: TransactionPaginationQuery): Promise<PaginatedTransactionsResult> {
    const conditions: Prisma.TransactionWhereInput[] = [
      { userId: query.userId },
      { deletedAt: null },
    ];

    if (query.status !== undefined) {
      conditions.push({ status: PrismaTransactionStatus[query.status] });
    }
    if (query.type !== undefined) {
      conditions.push({ type: PrismaTransactionType[query.type] });
    }
    if (query.accountId !== undefined) {
      conditions.push({ accountId: query.accountId });
    }
    if (query.categoryId !== undefined) {
      conditions.push({ categoryId: query.categoryId });
    }
    if (query.dateFrom !== undefined || query.dateTo !== undefined) {
      conditions.push({
        transactionDate: {
          ...(query.dateFrom !== undefined ? { gte: civilDateToUtcDate(query.dateFrom) } : {}),
          ...(query.dateTo !== undefined ? { lte: civilDateToUtcDate(query.dateTo) } : {}),
        },
      });
    }
    if (query.search) {
      const term = query.search.trim();
      conditions.push({
        OR: [
          { description: { contains: term, mode: "insensitive" } },
          { notes: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.TransactionWhereInput = { AND: conditions };
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
      query.sortBy === TransactionSortBy.AMOUNT
        ? [
          { amount: query.sortOrder },
          { transactionDate: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ]
        : [
          { transactionDate: query.sortOrder },
          { createdAt: query.sortOrder },
          { id: "asc" },
        ];

    const [records, total, confirmedIncomeAgg, confirmedExpenseAgg, pendingIncomeAgg] =
      await Promise.all([
        this.prisma.transaction.findMany({
          where,
          orderBy,
          skip: query.offset,
          take: query.pageSize,
        }),
        this.prisma.transaction.count({ where }),
        this.prisma.transaction.aggregate({
          where: {
            AND: [
              where,
              { type: PrismaTransactionType.INCOME, status: PrismaTransactionStatus.CONFIRMED },
            ],
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            AND: [
              where,
              { type: PrismaTransactionType.EXPENSE, status: PrismaTransactionStatus.CONFIRMED },
            ],
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            AND: [
              where,
              { type: PrismaTransactionType.INCOME, status: PrismaTransactionStatus.PENDING },
            ],
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

    const totalIncome = decimalToNumber(confirmedIncomeAgg._sum.amount);
    const totalExpense = decimalToNumber(confirmedExpenseAgg._sum.amount);
    const netResult = Number((totalIncome - totalExpense).toFixed(2));
    const pendingIncomeAmount = decimalToNumber(pendingIncomeAgg._sum.amount);

    return {
      items: records.map((record) => TransactionMapper.toEntity(record as TransactionRecord)),
      total,
      summary: {
        totalIncome,
        totalExpense,
        netResult,
        pendingIncomeAmount,
        pendingIncomeCount: pendingIncomeAgg._count._all,
      },
    };
  }

  async confirm(transaction: Transaction): Promise<Transaction> {
    try {
      const confirmed = await this.prisma.$transaction(async (tx) => {
        // Atualização condicional impede corrida entre confirmações simultâneas ou exclusão.
        const updatedCount = await tx.transaction.updateMany({
          where: {
            id: transaction.id,
            userId: transaction.userId,
            deletedAt: null,
            status: PrismaTransactionStatus.PENDING,
          },
          data: {
            status: PrismaTransactionStatus.CONFIRMED,
            confirmedAt: transaction.confirmedAt,
            updatedAt: transaction.updatedAt,
          },
        });

        if (updatedCount.count === 0) {
          const current = await tx.transaction.findFirst({
            where: { id: transaction.id, userId: transaction.userId, deletedAt: null },
          });
          if (!current) {
            throw transactionNotFoundError();
          }
          throw new AppError({
            status: 409,
            code: ErrorCode.CONFLICT,
            message: "Apenas transações pendentes podem ser confirmadas.",
          });
        }

        await tx.account.update({
          where: { id: transaction.accountId, userId: transaction.userId },
          data: {
            currentBalance: balanceAdjustmentFor(transaction.type, transaction.amount, "apply"),
            updatedAt: transaction.updatedAt,
          },
        });

        return tx.transaction.findUniqueOrThrow({
          where: { id: transaction.id },
        });
      });

      return TransactionMapper.toEntity(confirmed as TransactionRecord);
    } catch (error) {
      throw mapPrismaTransactionError(error);
    }
  }

  async softDelete(transaction: Transaction): Promise<boolean> {
    if (transaction.deletedAt === null) {
      throw new TypeError("A transação deve possuir deletedAt definido para exclusão lógica.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.transaction.updateMany({
          where: {
            id: transaction.id,
            userId: transaction.userId,
            deletedAt: null,
            status: PrismaTransactionStatus[transaction.status],
          },
          data: {
            deletedAt: transaction.deletedAt,
            updatedAt: transaction.updatedAt,
          },
        });

        if (result.count === 0) {
          return false;
        }

        // Apenas transações confirmadas haviam impactado o saldo e precisam de estorno.
        if (transaction.status === TransactionStatus.CONFIRMED) {
          await tx.account.update({
            where: { id: transaction.accountId, userId: transaction.userId },
            data: {
              currentBalance: balanceAdjustmentFor(transaction.type, transaction.amount, "revert"),
              updatedAt: transaction.updatedAt,
            },
          });
        }

        return true;
      });
    } catch (error) {
      throw mapPrismaTransactionError(error);
    }
  }
}

function civilDateToUtcDate(civilDate: string): Date {
  return new Date(`${civilDate}T00:00:00.000Z`);
}

function balanceAdjustmentFor(
  type: TransactionType,
  amount: number,
  direction: "apply" | "revert",
): { increment: number } | { decrement: number } {
  const positiveImpact =
    direction === "apply"
      ? type === TransactionType.INCOME
      : type === TransactionType.EXPENSE;
  const value = Number(amount.toFixed(2));
  return positiveImpact ? { increment: value } : { decrement: value };
}

function transactionNotFoundError(): AppError {
  return new AppError({
    status: 404,
    code: ErrorCode.NOT_FOUND,
    message: "Transação não encontrada.",
  });
}

function mapPrismaTransactionError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== "object" || !("code" in error)) return error;
  if (error.code === "P2003" || error.code === "P2025") {
    return new AppError({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: "Recurso vinculado à transação não encontrado.",
      cause: error,
    });
  }
  return error;
}
