import assert from "node:assert/strict";
import test from "node:test";
import { AccountsService } from "../../src/modules/accounts/application/services/accounts.service.js";
import { Account } from "../../src/modules/accounts/domain/entities/account.entity.js";
import { AccountStatus, AccountType } from "../../src/modules/accounts/domain/enums/account.enums.js";
import type { IAccountRepository } from "../../src/modules/accounts/domain/interfaces/account-repository.interface.js";
import type {
  AccountPaginationQuery,
  PaginatedAccountsResult,
} from "../../src/modules/accounts/domain/interfaces/account.interfaces.js";
import { CategoriesService } from "../../src/modules/categories/application/services/categories.service.js";
import { Category } from "../../src/modules/categories/domain/entities/category.entity.js";
import { CategoryStatus } from "../../src/modules/categories/domain/enums/category.enums.js";
import type { ICategoryRepository } from "../../src/modules/categories/domain/interfaces/category-repository.interface.js";
import type {
  CategoryPaginationQuery,
  PaginatedCategoriesResult,
} from "../../src/modules/categories/domain/interfaces/category.interfaces.js";
import { TransactionsService } from "../../src/modules/transactions/application/services/transactions.service.js";
import { Transaction } from "../../src/modules/transactions/domain/entities/transaction.entity.js";
import {
  SortOrder,
  TransactionSortBy,
  TransactionStatus,
  TransactionType,
} from "../../src/modules/transactions/domain/enums/transaction.enums.js";
import type { ITransactionRepository } from "../../src/modules/transactions/domain/interfaces/transaction-repository.interface.js";
import type {
  PaginatedTransactionsResult,
  TransactionPaginationQuery,
} from "../../src/modules/transactions/domain/interfaces/transaction.interfaces.js";
import {
  PrismaTransactionRepository,
  type PrismaTransactionClient,
} from "../../src/modules/transactions/infrastructure/repositories/prisma-transaction.repository.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";

class TestAccountRepository implements IAccountRepository {
  readonly items: Account[] = [];

  async create(account: Account): Promise<Account> {
    this.items.push(account);
    return account;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Account | null> {
    return this.items.find((item) => item.id === id && item.userId === userId) ?? null;
  }

  async findActiveByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeAccountId?: string,
  ): Promise<Account | null> {
    return this.items.find((item) =>
      item.userId === userId &&
      item.status === AccountStatus.ACTIVE &&
      item.normalizedName === normalizedName &&
      item.id !== excludeAccountId,
    ) ?? null;
  }

  async findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult> {
    const owned = this.items.filter((item) => item.userId === query.userId);
    return {
      items: owned.slice(query.offset, query.offset + query.pageSize),
      total: owned.length,
      summary: { totalBalance: 0, activeCount: owned.length, inactiveCount: 0 },
    };
  }

  async update(account: Account): Promise<Account> {
    const index = this.items.findIndex((item) => item.id === account.id);
    if (index >= 0) this.items[index] = account;
    return account;
  }

  async deleteByIdAndUserId(): Promise<boolean> { return true; }
  async countLinkedTransactions(): Promise<number> { return 0; }
}

class TestCategoryRepository implements ICategoryRepository {
  readonly items: Category[] = [];

  async create(category: Category): Promise<Category> {
    this.items.push(category);
    return category;
  }

  async findAccessibleById(id: string, userId: string): Promise<Category | null> {
    return this.items.find((item) => item.id === id && item.isAccessibleBy(userId)) ?? null;
  }

  async findByNormalizedNameForUser(): Promise<Category | null> { return null; }

  async findManyAccessibleByUserId(query: CategoryPaginationQuery): Promise<PaginatedCategoriesResult> {
    const accessible = this.items.filter((item) => item.isAccessibleBy(query.userId));
    return {
      items: accessible.slice(query.offset, query.offset + query.pageSize),
      total: accessible.length,
      summary: { activeCount: accessible.length, inactiveCount: 0, customCount: 0 },
    };
  }

  async update(category: Category): Promise<Category> {
    const index = this.items.findIndex((item) => item.id === category.id);
    if (index >= 0) this.items[index] = category;
    return category;
  }

  async deleteByIdAndUserId(): Promise<boolean> { return true; }
  async countLinkedTransactions(): Promise<number> { return 0; }
}

class TestTransactionRepository implements ITransactionRepository {
  readonly items: Transaction[] = [];

  constructor(private readonly accounts: TestAccountRepository) {}

  private adjustAccountBalance(accountId: string, delta: number): void {
    const index = this.accounts.items.findIndex((item) => item.id === accountId);
    const current = this.accounts.items[index];
    if (!current) return;
    const json = current.toJSON();
    this.accounts.items[index] = new Account({
      ...json,
      currentBalance: Number((json.currentBalance + delta).toFixed(2)),
    });
  }

  async create(transaction: Transaction): Promise<Transaction> {
    this.items.push(transaction);
    if (transaction.status === TransactionStatus.CONFIRMED) {
      this.adjustAccountBalance(transaction.accountId, transaction.getSignedBalanceDelta());
    }
    return transaction;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Transaction | null> {
    return this.items.find(
      (item) => item.id === id && item.userId === userId && item.deletedAt === null,
    ) ?? null;
  }

  async findManyByUserId(query: TransactionPaginationQuery): Promise<PaginatedTransactionsResult> {
    const matching = this.items.filter((item) => {
      if (item.userId !== query.userId || item.deletedAt !== null) return false;
      if (query.status && item.status !== query.status) return false;
      if (query.type && item.type !== query.type) return false;
      if (query.accountId && item.accountId !== query.accountId) return false;
      if (query.categoryId && item.categoryId !== query.categoryId) return false;
      if (query.dateFrom && item.transactionDate < query.dateFrom) return false;
      if (query.dateTo && item.transactionDate > query.dateTo) return false;
      if (query.search) {
        const needle = query.search.toLowerCase();
        const hit =
          item.description.toLowerCase().includes(needle) ||
          (item.notes ?? "").toLowerCase().includes(needle);
        if (!hit) return false;
      }
      return true;
    });

    const sorted = [...matching].sort((a, b) => {
      const cmp =
        query.sortBy === TransactionSortBy.AMOUNT
          ? a.amount - b.amount
          : a.transactionDate.localeCompare(b.transactionDate);
      return query.sortOrder === SortOrder.ASC ? cmp : -cmp;
    });

    const totalIncome = Number(
      matching
        .filter((i) => i.type === TransactionType.INCOME && i.status === TransactionStatus.CONFIRMED)
        .reduce((sum, i) => sum + i.amount, 0)
        .toFixed(2),
    );
    const totalExpense = Number(
      matching
        .filter((i) => i.type === TransactionType.EXPENSE && i.status === TransactionStatus.CONFIRMED)
        .reduce((sum, i) => sum + i.amount, 0)
        .toFixed(2),
    );
    const pendingIncomes = matching.filter(
      (i) => i.type === TransactionType.INCOME && i.status === TransactionStatus.PENDING,
    );

    return {
      items: sorted.slice(query.offset, query.offset + query.pageSize),
      total: sorted.length,
      summary: {
        totalIncome,
        totalExpense,
        netResult: Number((totalIncome - totalExpense).toFixed(2)),
        pendingIncomeAmount: Number(pendingIncomes.reduce((s, i) => s + i.amount, 0).toFixed(2)),
        pendingIncomeCount: pendingIncomes.length,
      },
    };
  }

  async confirm(transaction: Transaction): Promise<Transaction> {
    const index = this.items.findIndex((item) => item.id === transaction.id);
    if (index >= 0) this.items[index] = transaction;
    this.adjustAccountBalance(transaction.accountId, transaction.getSignedBalanceDelta());
    return transaction;
  }

  async softDelete(transaction: Transaction): Promise<boolean> {
    const index = this.items.findIndex((item) => item.id === transaction.id);
    if (index < 0) return false;
    this.items[index] = transaction;
    if (transaction.status === TransactionStatus.CONFIRMED) {
      this.adjustAccountBalance(transaction.accountId, -transaction.getSignedBalanceDelta());
    }
    return true;
  }
}

test("TransactionsService valida conta e categoria via services reais e atualiza saldo atomicamente", async () => {
  const accountRepo = new TestAccountRepository();
  const categoryRepo = new TestCategoryRepository();
  const txRepo = new TestTransactionRepository(accountRepo);

  const accountsService = new AccountsService(accountRepo, noopLogger);
  const categoriesService = new CategoriesService(categoryRepo, noopLogger);
  const service = new TransactionsService(txRepo, accountsService, categoriesService, noopLogger);

  const activeAccount = await accountsService.createAccount({
    userId: ownerId,
    name: "Conta Principal",
    type: AccountType.CHECKING,
    initialBalance: 1000,
  });
  const inactiveAccount = await accountsService.createAccount({
    userId: ownerId,
    name: "Conta Antiga",
    type: AccountType.DIGITAL,
    initialBalance: 500,
  });
  await accountsService.deactivateAccount({ userId: ownerId, accountId: inactiveAccount.id });

  const activeCategory = await categoriesService.createCategory({
    userId: ownerId,
    name: "Mercado",
    color: "#015363",
    icon: "utensils",
  });
  const inactiveCategory = await categoriesService.createCategory({
    userId: ownerId,
    name: "Categoria Arquivada",
  });
  await categoriesService.deactivateCategory({ userId: ownerId, categoryId: inactiveCategory.id });

  // Criação sem categoria (opcional) com receita confirmada -> saldo +500 = 1500.
  const noCatIncome = await service.createTransaction({
    userId: ownerId,
    accountId: activeAccount.id,
    description: "Reembolso sem categoria",
    amount: 500,
    type: TransactionType.INCOME,
    transactionDate: "2026-11-10",
  });
  assert.equal(noCatIncome.categoryId, null);
  assert.equal(noCatIncome.status, TransactionStatus.CONFIRMED);
  assert.equal((await accountsService.getAccountById({ userId: ownerId, accountId: activeAccount.id })).currentBalance, 1500);

  // Criação com categoria válida + despesa pendente -> saldo permanece 1500.
  const pendingExpense = await service.createTransaction({
    userId: ownerId,
    accountId: activeAccount.id,
    categoryId: activeCategory.id,
    description: "Compra programada",
    amount: 200,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    transactionDate: "2026-11-20",
  });
  assert.equal(pendingExpense.status, TransactionStatus.PENDING);
  assert.equal((await accountsService.getAccountById({ userId: ownerId, accountId: activeAccount.id })).currentBalance, 1500);

  // Rejeita categoria inexistente (404), categoria inativa (409) e conta inativa (409).
  await assert.rejects(
    service.createTransaction({
      userId: ownerId,
      accountId: activeAccount.id,
      categoryId: "88888888-8888-4888-8888-888888888888",
      description: "Teste inexistente",
      amount: 25,
      type: TransactionType.EXPENSE,
      transactionDate: "2026-11-15",
    }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );

  await assert.rejects(
    service.createTransaction({
      userId: ownerId,
      accountId: activeAccount.id,
      categoryId: inactiveCategory.id,
      description: "Teste categoria inativa",
      amount: 25,
      type: TransactionType.EXPENSE,
      transactionDate: "2026-11-15",
    }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  await assert.rejects(
    service.createTransaction({
      userId: ownerId,
      accountId: inactiveAccount.id,
      description: "Teste conta inativa",
      amount: 25,
      type: TransactionType.EXPENSE,
      transactionDate: "2026-11-15",
    }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  // Confirmar receita e despesa pendentes atualiza saldo e impede reconfirmação (409).
  const pendingIncome = await service.createTransaction({
    userId: ownerId,
    accountId: activeAccount.id,
    description: "Consultoria a receber",
    amount: 300,
    type: TransactionType.INCOME,
    status: TransactionStatus.PENDING,
    transactionDate: "2026-11-22",
  });

  // Resumo da listagem reflete receitas/despesas confirmadas e pendentes a receber.
  const listBeforeConfirm = await service.listTransactions({
    userId: ownerId,
    page: 1,
    pageSize: 10,
    offset: 0,
  });
  assert.equal(listBeforeConfirm.meta.totalIncome, 500);
  assert.equal(listBeforeConfirm.meta.totalExpense, 0);
  assert.equal(listBeforeConfirm.meta.netResult, 500);
  assert.equal(listBeforeConfirm.meta.pendingIncomeAmount, 300);
  assert.equal(listBeforeConfirm.meta.pendingIncomeCount, 1);

  await service.confirmTransaction({ userId: ownerId, transactionId: pendingExpense.id });
  assert.equal((await accountsService.getAccountById({ userId: ownerId, accountId: activeAccount.id })).currentBalance, 1300);

  await service.confirmTransaction({ userId: ownerId, transactionId: pendingIncome.id });
  assert.equal((await accountsService.getAccountById({ userId: ownerId, accountId: activeAccount.id })).currentBalance, 1600);

  await assert.rejects(
    service.confirmTransaction({ userId: ownerId, transactionId: pendingIncome.id }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  // Anti-IDOR.
  await assert.rejects(
    service.getTransactionById({ userId: otherUserId, transactionId: pendingIncome.id }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );

  // Soft delete de transação confirmada estorna saldo (-300 -> 1300) e oculta da listagem.
  await service.deleteTransaction({ userId: ownerId, transactionId: pendingIncome.id });
  assert.equal((await accountsService.getAccountById({ userId: ownerId, accountId: activeAccount.id })).currentBalance, 1300);
  await assert.rejects(
    service.getTransactionById({ userId: ownerId, transactionId: pendingIncome.id }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
});

test("TransactionsService valida filtros de intervalo e ordenação", async () => {
  const accountRepo = new TestAccountRepository();
  const categoryRepo = new TestCategoryRepository();
  const txRepo = new TestTransactionRepository(accountRepo);
  const service = new TransactionsService(
    txRepo,
    new AccountsService(accountRepo, noopLogger),
    new CategoriesService(categoryRepo, noopLogger),
    noopLogger,
  );

  await assert.rejects(
    service.listTransactions({
      userId: ownerId,
      page: 1,
      pageSize: 10,
      offset: 0,
      dateFrom: "2026-11-20",
      dateTo: "2026-11-10",
    }),
    (error: unknown) => error instanceof AppError && error.status === 400,
  );
});

test("PrismaTransactionRepository executa atualização atômica de saldo em $transaction e calcula resumo", async () => {
  const accountUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  let confirmUpdateCount = 1;
  let softDeleteUpdateCount = 1;

  const sampleRecord = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: ownerId,
    accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    categoryId: null,
    description: "Pagamento",
    amount: "150.25",
    type: "EXPENSE",
    status: "CONFIRMED",
    transactionDate: new Date("2026-11-15T00:00:00.000Z"),
    notes: null,
    confirmedAt: new Date("2026-11-15T10:00:00.000Z"),
    createdAt: new Date("2026-11-15T10:00:00.000Z"),
    updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    deletedAt: null,
  };

  const prismaMock = {
    transaction: {
      findFirst: async () => ({ ...sampleRecord, status: "CONFIRMED" }),
      findMany: async () => [sampleRecord],
      count: async () => 1,
      aggregate: async (args: { where: Record<string, unknown> }) => {
        const serialized = JSON.stringify(args.where);
        if (serialized.includes('"INCOME"') && serialized.includes('"CONFIRMED"')) {
          return { _sum: { amount: "500.00" } };
        }
        if (serialized.includes('"EXPENSE"') && serialized.includes('"CONFIRMED"')) {
          return { _sum: { amount: "150.25" } };
        }
        return { _sum: { amount: "200.00" }, _count: { _all: 2 } };
      },
      create: async () => sampleRecord,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => sampleRecord,
    },
    account: {
      update: async () => ({}),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const txClient = {
        transaction: {
          create: async () => sampleRecord,
          findFirst: async () => ({ ...sampleRecord, status: "CONFIRMED" }),
          updateMany: async (args: { data: Record<string, unknown> }) => {
            if (Object.hasOwn(args.data, "deletedAt")) {
              return { count: softDeleteUpdateCount };
            }
            return { count: confirmUpdateCount };
          },
          findUniqueOrThrow: async () => sampleRecord,
        },
        account: {
          update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
            accountUpdates.push(args);
            return {};
          },
        },
      };
      return fn(txClient);
    },
  } as unknown as PrismaTransactionClient;

  const repository = new PrismaTransactionRepository(prismaMock);

  // Create CONFIRMED EXPENSE -> decrementa 150.25 no saldo.
  const entity = Transaction.create({
    id: sampleRecord.id,
    userId: ownerId,
    accountId: sampleRecord.accountId,
    description: "Pagamento",
    amount: 150.25,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CONFIRMED,
    transactionDate: "2026-11-15",
  });
  await repository.create(entity);
  assert.deepEqual(accountUpdates[0]?.data.currentBalance, { decrement: 150.25 });

  // Listagem calcula totais consolidados.
  const listed = await repository.findManyByUserId({
    userId: ownerId,
    page: 1,
    pageSize: 20,
    offset: 0,
    sortBy: TransactionSortBy.TRANSACTION_DATE,
    sortOrder: SortOrder.DESC,
  });
  assert.equal(listed.summary.totalIncome, 500);
  assert.equal(listed.summary.totalExpense, 150.25);
  assert.equal(listed.summary.netResult, 349.75);
  assert.equal(listed.summary.pendingIncomeAmount, 200);
  assert.equal(listed.summary.pendingIncomeCount, 2);

  // Confirmação concorrente em registro já CONFIRMED lança 409.
  const pendingEntity = Transaction.create({
    id: sampleRecord.id,
    userId: ownerId,
    accountId: sampleRecord.accountId,
    description: "Pagamento",
    amount: 150.25,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    transactionDate: "2026-11-15",
  });
  pendingEntity.confirm();
  confirmUpdateCount = 0;
  await assert.rejects(
    repository.confirm(pendingEntity),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  // Soft delete de CONFIRMED EXPENSE -> estorna (+150.25).
  entity.softDelete();
  softDeleteUpdateCount = 1;
  assert.equal(await repository.softDelete(entity), true);
  assert.deepEqual(accountUpdates.at(-1)?.data.currentBalance, { increment: 150.25 });
});
