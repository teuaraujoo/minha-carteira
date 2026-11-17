import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import {
  AccountStatus as PrismaAccountStatus,
  AccountType as PrismaAccountType,
} from "../../../../../generated/prisma/enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { Account } from "../../domain/entities/account.entity.js";
import { AccountStatus, AccountType } from "../../domain/enums/account.enums.js";
import type { IAccountRepository } from "../../domain/interfaces/account-repository.interface.js";
import type {
  AccountCategorySpendItem,
  AccountDetailMetricsData,
  AccountDetailMetricsQuery,
  AccountMonthlySeriesItem,
  AccountPaginationQuery,
  PaginatedAccountsResult,
} from "../../domain/interfaces/account.interfaces.js";

const PORTUGUESE_MONTH_ABBR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export type PrismaAccountClient = Pick<PrismaClient, "account">;

interface AccountRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  brand: string | null;
  institution: string | null;
  color: string | null;
  initialBalance: unknown;
  currentBalance: unknown;
  status: string;
  inactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaAccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaAccountClient) {}

  async create(account: Account): Promise<Account> {
    try {
      const created = await this.prisma.account.create({
        data: {
          id: account.id,
          userId: account.userId,
          name: account.name,
          type: PrismaAccountType[account.type],
          brand: account.brand,
          institution: account.institution,
          color: account.color,
          initialBalance: account.initialBalance,
          currentBalance: account.currentBalance,
          status: PrismaAccountStatus[account.status],
          inactivatedAt: account.inactivatedAt,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
      });
      return this.toDomain(created as AccountRecord);
    } catch (error) {
      throw mapPrismaAccountError(error);
    }
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Account | null> {
    const record = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    return record ? this.toDomain(record as AccountRecord) : null;
  }

  async findActiveByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeAccountId?: string,
  ): Promise<Account | null> {
    const trimmed = normalizedName.trim();
    if (!trimmed) return null;

    const record = await this.prisma.account.findFirst({
      where: {
        userId,
        status: PrismaAccountStatus.ACTIVE,
        name: { equals: trimmed, mode: "insensitive" },
        ...(excludeAccountId ? { id: { not: excludeAccountId } } : {}),
      },
    });
    return record ? this.toDomain(record as AccountRecord) : null;
  }

  async findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult> {
    const trimmedSearch = query.search?.trim();
    const where: Prisma.AccountWhereInput = {
      userId: query.userId,
      ...(query.status ? { status: PrismaAccountStatus[query.status] } : {}),
      ...(query.type ? { type: PrismaAccountType[query.type] } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: "insensitive" } },
              { institution: { contains: trimmedSearch, mode: "insensitive" } },
              { brand: { contains: trimmedSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [records, total, activeSummary, inactiveCount] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip: query.offset,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      }),
      this.prisma.account.count({ where }),
      this.prisma.account.aggregate({
        where: { userId: query.userId, status: PrismaAccountStatus.ACTIVE },
        _sum: { currentBalance: true },
        _count: { _all: true },
      }),
      this.prisma.account.count({
        where: { userId: query.userId, status: PrismaAccountStatus.INACTIVE },
      }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record as AccountRecord)),
      total,
      summary: {
        totalBalance: decimalToNumber(activeSummary._sum.currentBalance),
        activeCount: activeSummary._count._all,
        inactiveCount,
      },
    };
  }

  async update(account: Account): Promise<Account> {
    try {
      // Atualiza apenas dados cadastrais/visuais e estado; saldos permanecem protegidos.
      const updated = await this.prisma.account.update({
        where: { id: account.id, userId: account.userId },
        data: {
          name: account.name,
          type: PrismaAccountType[account.type],
          brand: account.brand,
          institution: account.institution,
          color: account.color,
          status: PrismaAccountStatus[account.status],
          inactivatedAt: account.inactivatedAt,
          updatedAt: account.updatedAt,
        },
      });
      return this.toDomain(updated as AccountRecord);
    } catch (error) {
      throw mapPrismaAccountError(error);
    }
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.account.deleteMany({
        where: { id, userId },
      });
      return result.count > 0;
    } catch (error) {
      throw mapPrismaAccountError(error);
    }
  }

  /** Retorna a contagem de transações não excluídas vinculadas à conta financeira. */
  async countLinkedTransactions(accountId: string, userId: string): Promise<number> {
    const transactionDelegate = (
      this.prisma as Partial<Pick<PrismaClient, "transaction">>
    ).transaction;
    if (!transactionDelegate) return 0;
    return transactionDelegate.count({
      where: {
        accountId,
        userId,
        deletedAt: null,
      },
    });
  }

  /** Calcula métricas mensais, série de 6 meses e gastos por categoria da conta na competência. */
  async getDetailMetrics(query: AccountDetailMetricsQuery): Promise<AccountDetailMetricsData> {
    const slots = buildMonthlySlots(query.year, query.month);
    const targetMonthKey = formatMonthKey(query.year, query.month);
    const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1));
    const nextMonthStart = new Date(Date.UTC(query.year, query.month, 1));
    const seriesStart = new Date(Date.UTC(query.year, query.month - 6, 1));

    const delegates = this.prisma as Partial<Pick<PrismaClient, "transaction" | "category">>;
    if (!delegates.transaction) {
      return {
        month: targetMonthKey,
        income: 0,
        expense: 0,
        netResult: 0,
        pending: { count: 0, amount: 0, incomeAmount: 0, expenseAmount: 0 },
        monthlySeries: slots,
        categorySpend: [],
      };
    }

    const [confirmedRows, pendingRows] = await Promise.all([
      delegates.transaction.findMany({
        where: {
          accountId: query.accountId,
          userId: query.userId,
          deletedAt: null,
          status: "CONFIRMED",
          transactionDate: { gte: seriesStart, lt: nextMonthStart },
        },
        select: {
          type: true,
          amount: true,
          transactionDate: true,
          categoryId: true,
        },
      }),
      delegates.transaction.findMany({
        where: {
          accountId: query.accountId,
          userId: query.userId,
          deletedAt: null,
          status: "PENDING",
          transactionDate: { gte: monthStart, lt: nextMonthStart },
        },
        select: {
          type: true,
          amount: true,
        },
      }),
    ]);

    const slotByMonth = new Map<string, AccountMonthlySeriesItem>(
      slots.map((slot) => [slot.month, slot]),
    );
    const expenseByCategory = new Map<string | null, number>();
    let targetIncome = 0;
    let targetExpense = 0;

    for (const row of confirmedRows) {
      const numericAmount = decimalToNumber(row.amount);
      const txDate = row.transactionDate instanceof Date ? row.transactionDate : new Date(row.transactionDate);
      const rowMonthKey = formatMonthKey(txDate.getUTCFullYear(), txDate.getUTCMonth() + 1);
      const slot = slotByMonth.get(rowMonthKey);

      if (slot) {
        if (row.type === "INCOME") {
          slot.income = roundCurrency(slot.income + numericAmount);
        } else {
          slot.expense = roundCurrency(slot.expense + numericAmount);
        }
      }

      if (txDate >= monthStart && txDate < nextMonthStart) {
        if (row.type === "INCOME") {
          targetIncome = roundCurrency(targetIncome + numericAmount);
        } else {
          targetExpense = roundCurrency(targetExpense + numericAmount);
          const categoryKey = row.categoryId ?? null;
          expenseByCategory.set(
            categoryKey,
            roundCurrency((expenseByCategory.get(categoryKey) ?? 0) + numericAmount),
          );
        }
      }
    }

    let pendingIncome = 0;
    let pendingExpense = 0;
    for (const row of pendingRows) {
      const numericAmount = decimalToNumber(row.amount);
      if (row.type === "INCOME") {
        pendingIncome = roundCurrency(pendingIncome + numericAmount);
      } else {
        pendingExpense = roundCurrency(pendingExpense + numericAmount);
      }
    }

    const categoryIds = Array.from(expenseByCategory.keys()).filter(
      (id): id is string => typeof id === "string",
    );
    const categories =
      categoryIds.length > 0 && delegates.category
        ? await delegates.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, color: true, icon: true },
          })
        : [];
    const categoryMetaById = new Map(categories.map((item) => [item.id, item]));

    const categorySpend: AccountCategorySpendItem[] = Array.from(expenseByCategory.entries())
      .map(([categoryId, amount]) => {
        const meta = categoryId ? categoryMetaById.get(categoryId) : undefined;
        return {
          categoryId: meta ? meta.id : null,
          name: meta ? meta.name : "Sem categoria",
          color: meta?.color ?? null,
          icon: meta?.icon ?? null,
          amount,
          percentage: targetExpense > 0 ? Number(((amount / targetExpense) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "pt-BR"));

    return {
      month: targetMonthKey,
      income: targetIncome,
      expense: targetExpense,
      netResult: roundCurrency(targetIncome - targetExpense),
      pending: {
        count: pendingRows.length,
        amount: roundCurrency(pendingIncome + pendingExpense),
        incomeAmount: pendingIncome,
        expenseAmount: pendingExpense,
      },
      monthlySeries: slots,
      categorySpend,
    };
  }

  private toDomain(record: AccountRecord): Account {
    return new Account({
      id: record.id,
      userId: record.userId,
      name: record.name,
      type: record.type as AccountType,
      brand: record.brand,
      institution: record.institution,
      color: record.color,
      initialBalance: decimalToNumber(record.initialBalance),
      currentBalance: decimalToNumber(record.currentBalance),
      status: record.status as AccountStatus,
      inactivatedAt: record.inactivatedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}

function decimalToNumber(value: unknown): number {
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

function roundCurrency(value: number): number {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return Number(normalized.toFixed(2));
}

function formatMonthKey(year: number, month: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function buildMonthlySlots(year: number, month: number): AccountMonthlySeriesItem[] {
  const slots: AccountMonthlySeriesItem[] = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    const slotDate = new Date(Date.UTC(year, month - 1 + offset, 1));
    const slotYear = slotDate.getUTCFullYear();
    const slotMonth = slotDate.getUTCMonth() + 1;
    slots.push({
      month: formatMonthKey(slotYear, slotMonth),
      label: `${PORTUGUESE_MONTH_ABBR[slotMonth - 1]}/${slotYear}`,
      income: 0,
      expense: 0,
    });
  }
  return slots;
}

function mapPrismaAccountError(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("code" in error)) return error;
  if (error.code === "P2002") {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: "Já existe uma conta ativa cadastrada com esse nome.",
      cause: error,
    });
  }
  if (error.code === "P2003") {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: "Esta conta possui histórico de transações vinculado e não pode ser excluída. Desative-a para preservá-la no histórico.",
      cause: error,
    });
  }
  if (error.code === "P2025") {
    return new AppError({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: "Conta não encontrada.",
      cause: error,
    });
  }
  return error;
}
