import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import {
  AccountStatus as PrismaAccountStatus,
  AccountType as PrismaAccountType,
} from "../../../../../generated/prisma/enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { Account } from "../../domain/entities/account.entity.js";
import { AccountStatus, AccountType } from "../../domain/enums/account.enums.js";
import type { IAccountRepository } from "../../domain/interfaces/account-repository.interface.js";
import type { AccountPaginationQuery, PaginatedAccountsResult } from "../../domain/interfaces/account.interfaces.js";

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
    const result = await this.prisma.account.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  /** Gancho preparatório: retornará a contagem real assim que o módulo `transactions` for implementado. */
  async countLinkedTransactions(_accountId: string, _userId: string): Promise<number> {
    return 0;
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
