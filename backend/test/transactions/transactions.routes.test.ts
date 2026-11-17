import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createApp } from "../../src/app/app.js";
import {
  Account,
  AccountStatus,
  AccountsService,
  AccountType,
  type AccountDetailMetricsData,
  type AccountDetailMetricsQuery,
  type AccountPaginationQuery,
  type IAccountRepository,
  type PaginatedAccountsResult,
} from "../../src/modules/accounts/index.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { JsonWebTokenProvider } from "../../src/modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { createCsrfToken } from "../../src/modules/auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../src/modules/auth/presentation/security/auth-cookies.js";
import {
  CategoriesService,
  Category,
  CategoryStatus,
  type CategoryPaginationQuery,
  type ICategoryRepository,
  type PaginatedCategoriesResult,
} from "../../src/modules/categories/index.js";
import {
  createTransactionsRouter,
  SortOrder,
  Transaction,
  TransactionSortBy,
  TransactionsService,
  TransactionStatus,
  TransactionType,
  type ITransactionRepository,
  type PaginatedTransactionsResult,
  type TransactionPaginationQuery,
} from "../../src/modules/transactions/index.js";
import type { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const origin = "https://carteira.example";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const ownerSessionId = "33333333-3333-4333-8333-333333333333";
const otherSessionId = "44444444-4444-4444-8444-444444444444";
const activeAccountId = "55555555-5555-4555-8555-555555555555";
const inactiveAccountId = "66666666-6666-4666-8666-666666666666";
const activeCategoryId = "77777777-7777-4777-8777-777777777777";
const inactiveCategoryId = "88888888-8888-4888-8888-888888888888";

class HttpMemoryAccountRepository implements IAccountRepository {
  readonly items: Account[] = [
    Account.create({
      id: activeAccountId,
      userId: ownerId,
      name: "Conta Corrente",
      type: AccountType.CHECKING,
      initialBalance: 1000,
    }),
    (() => {
      const inactive = Account.create({
        id: inactiveAccountId,
        userId: ownerId,
        name: "Conta Encerrada",
        type: AccountType.DIGITAL,
        initialBalance: 200,
      });
      inactive.deactivate();
      return inactive;
    })(),
  ];

  async create(account: Account): Promise<Account> {
    this.items.push(account);
    return account;
  }
  async findByIdAndUserId(id: string, userId: string): Promise<Account | null> {
    return this.items.find((item) => item.id === id && item.userId === userId) ?? null;
  }
  async findActiveByNormalizedName(): Promise<Account | null> { return null; }
  async findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult> {
    return { items: [], total: 0, summary: { totalBalance: 0, activeCount: 0, inactiveCount: 0 } };
  }
  async update(account: Account): Promise<Account> {
    const idx = this.items.findIndex((i) => i.id === account.id);
    if (idx >= 0) this.items[idx] = account;
    return account;
  }
  async deleteByIdAndUserId(): Promise<boolean> { return false; }
  async countLinkedTransactions(): Promise<number> { return 0; }
  async getDetailMetrics(query: AccountDetailMetricsQuery): Promise<AccountDetailMetricsData> {
    return {
      month: `${String(query.month).padStart(2, "0")}/${query.year}`,
      income: 0,
      expense: 0,
      netResult: 0,
      pending: { count: 0, amount: 0, incomeAmount: 0, expenseAmount: 0 },
      monthlySeries: [],
      categorySpend: [],
    };
  }
}

class HttpMemoryCategoryRepository implements ICategoryRepository {
  readonly items: Category[] = [
    new Category({
      id: activeCategoryId,
      userId: null,
      name: "Alimentação",
      color: "#015363",
      icon: "utensils",
      isDefault: true,
      status: CategoryStatus.ACTIVE,
      createdAt: new Date("2026-11-15T10:00:00.000Z"),
      updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    }),
    (() => {
      const inactive = Category.create({
        id: inactiveCategoryId,
        userId: ownerId,
        name: "Antiga",
      });
      inactive.deactivate();
      return inactive;
    })(),
  ];

  async create(category: Category): Promise<Category> {
    this.items.push(category);
    return category;
  }
  async findAccessibleById(id: string, userId: string): Promise<Category | null> {
    return this.items.find((item) => item.id === id && item.isAccessibleBy(userId)) ?? null;
  }
  async findByNormalizedNameForUser(): Promise<Category | null> { return null; }
  async findManyAccessibleByUserId(query: CategoryPaginationQuery): Promise<PaginatedCategoriesResult> {
    return { items: [], total: 0, summary: { activeCount: 0, inactiveCount: 0, customCount: 0 } };
  }
  async update(category: Category): Promise<Category> { return category; }
  async deleteByIdAndUserId(): Promise<boolean> { return false; }
  async countLinkedTransactions(): Promise<number> { return 0; }
  async getDetailMetrics(query: AccountDetailMetricsQuery): Promise<AccountDetailMetricsData> {
    return {
      month: `${String(query.month).padStart(2, "0")}/${query.year}`,
      income: 0,
      expense: 0,
      netResult: 0,
      pending: { count: 0, amount: 0, incomeAmount: 0, expenseAmount: 0 },
      monthlySeries: [],
      categorySpend: [],
    };
  }
}

class HttpMemoryTransactionRepository implements ITransactionRepository {
  readonly items: Transaction[] = [];

  constructor(private readonly accounts: HttpMemoryAccountRepository) {}

  private adjustBalance(accountId: string, delta: number): void {
    const idx = this.accounts.items.findIndex((a) => a.id === accountId);
    const account = this.accounts.items[idx];
    if (!account) return;
    const json = account.toJSON();
    this.accounts.items[idx] = new Account({
      ...json,
      currentBalance: Number((json.currentBalance + delta).toFixed(2)),
    });
  }

  async create(transaction: Transaction): Promise<Transaction> {
    this.items.push(transaction);
    if (transaction.status === TransactionStatus.CONFIRMED) {
      this.adjustBalance(transaction.accountId, transaction.getSignedBalanceDelta());
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
        if (
          !item.description.toLowerCase().includes(needle) &&
          !(item.notes ?? "").toLowerCase().includes(needle)
        ) {
          return false;
        }
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
        .reduce((s, i) => s + i.amount, 0)
        .toFixed(2),
    );
    const totalExpense = Number(
      matching
        .filter((i) => i.type === TransactionType.EXPENSE && i.status === TransactionStatus.CONFIRMED)
        .reduce((s, i) => s + i.amount, 0)
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
    const idx = this.items.findIndex((item) => item.id === transaction.id);
    if (idx >= 0) this.items[idx] = transaction;
    this.adjustBalance(transaction.accountId, transaction.getSignedBalanceDelta());
    return transaction;
  }

  async softDelete(transaction: Transaction): Promise<boolean> {
    const idx = this.items.findIndex((item) => item.id === transaction.id);
    if (idx < 0) return false;
    this.items[idx] = transaction;
    if (transaction.status === TransactionStatus.CONFIRMED) {
      this.adjustBalance(transaction.accountId, -transaction.getSignedBalanceDelta());
    }
    return true;
  }
}

async function withTransactionsServer(
  run: (context: {
    baseUrl: string;
    ownerCookie: string;
    otherCookie: string;
    csrfToken: string;
    accountsRepo: HttpMemoryAccountRepository;
  }) => Promise<void>,
): Promise<void> {
  const accountsRepo = new HttpMemoryAccountRepository();
  const categoriesRepo = new HttpMemoryCategoryRepository();
  const txRepo = new HttpMemoryTransactionRepository(accountsRepo);
  const accountsService = new AccountsService(accountsRepo, noopLogger);
  const categoriesService = new CategoriesService(categoriesRepo, noopLogger);
  const transactionsService = new TransactionsService(
    txRepo,
    accountsService,
    categoriesService,
    noopLogger,
  );

  const jwtProvider = new JsonWebTokenProvider("segredo-transactions-http-teste", "minha-carteira-api");
  const ownerToken = await jwtProvider.signAccessToken({ userId: ownerId, sessionId: ownerSessionId });
  const otherToken = await jwtProvider.signAccessToken({ userId: otherUserId, sessionId: otherSessionId });
  const csrfToken = createCsrfToken();

  const refreshTokenRepository: IRefreshTokenRepository = {
    save: async () => undefined,
    findActiveById: async (sessionId) => {
      if (sessionId === ownerSessionId) return { id: ownerSessionId, userId: ownerId } as never;
      if (sessionId === otherSessionId) return { id: otherSessionId, userId: otherUserId } as never;
      return null;
    },
    registerUse: async () => undefined,
    revoke: async () => undefined,
    revokeAllFromUser: async () => undefined,
  };
  const userService = {
    findActiveUserById: async (userId: string) => ({
      id: userId,
      role: "USER",
      capabilities: [],
      status: UserStatus.ACTIVE,
    }),
  } as unknown as UserService;

  const transactionsRouter = createTransactionsRouter(
    transactionsService,
    jwtProvider,
    refreshTokenRepository,
    userService,
    [origin],
  );
  const app = createApp({
    logger: noopLogger,
    authRouter: Router(),
    usersRouter: Router(),
    transactionsRouter,
    allowedOrigins: [origin],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;

  try {
    await run({
      baseUrl: `http://127.0.0.1:${address.port}/api/v1/transactions`,
      ownerCookie: `${AUTH_COOKIE_NAMES.access}=${ownerToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      otherCookie: `${AUTH_COOKIE_NAMES.access}=${otherToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      csrfToken,
      accountsRepo,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("rotas /api/v1/transactions exigem autenticação (401), CSRF (403) e mantêm imutabilidade sem PATCH de edição", async () => {
  await withTransactionsServer(async ({ baseUrl, ownerCookie, csrfToken }) => {
    const unauth = await fetch(baseUrl);
    assert.equal(unauth.status, 401);

    const noCsrf = await fetch(baseUrl, {
      method: "POST",
      headers: { Origin: origin, Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: activeAccountId,
        description: "Sem CSRF",
        amount: 50,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-15",
      }),
    });
    assert.equal(noCsrf.status, 403);

    // Imutabilidade: PATCH direto no recurso não existe (404).
    const genericPatch = await fetch(`${baseUrl}/99999999-9999-4999-8999-999999999999`, {
      method: "PATCH",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 999 }),
    });
    assert.equal(genericPatch.status, 404);
  });
});

test("fluxo completo HTTP de /api/v1/transactions: criação, filtros/ordenação na URL, confirmação, exclusão lógica e anti-IDOR", async () => {
  await withTransactionsServer(async ({ baseUrl, ownerCookie, otherCookie, csrfToken, accountsRepo }) => {
    // Rejeita categoria inativa (409) e categoria inexistente (404).
    const inactiveCatRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: activeAccountId,
        categoryId: inactiveCategoryId,
        description: "Com categoria inativa",
        amount: 50,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-15",
      }),
    });
    assert.equal(inactiveCatRes.status, 409);

    const missingCatRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: activeAccountId,
        categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        description: "Categoria inexistente",
        amount: 50,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-15",
      }),
    });
    assert.equal(missingCatRes.status, 404);

    const unknownQueryRes = await fetch(`${baseUrl}?foo=bar`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(unknownQueryRes.status, 400);

    const overflowAmountRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: activeAccountId,
        description: "Acima do limite decimal",
        amount: 1_000_000_000_000,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-15",
      }),
    });
    assert.equal(overflowAmountRes.status, 400);

    // Cria despesa confirmada com categoria -> saldo 1000 - 120 = 880.
    const expRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: activeAccountId,
        categoryId: activeCategoryId,
        description: "Almoço de trabalho",
        amount: 120,
        type: TransactionType.EXPENSE,
        transactionDate: "2026-11-12",
        notes: "Nota de teste",
      }),
    });
    assert.equal(expRes.status, 201);
    const expBody = (await expRes.json()) as { data: { id: string; status: string; categoryId: string } };
    assert.equal(expBody.data.status, TransactionStatus.CONFIRMED);
    assert.equal(expBody.data.categoryId, activeCategoryId);
    assert.equal(accountsRepo.items[0]?.currentBalance, 880);

    // Cria receita pendente sem categoria -> saldo permanece 880.
    const incPendingRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: activeAccountId,
        description: "Projeto cliente X",
        amount: 400,
        type: TransactionType.INCOME,
        status: TransactionStatus.PENDING,
        transactionDate: "2026-11-18",
      }),
    });
    assert.equal(incPendingRes.status, 201);
    const incPendingBody = (await incPendingRes.json()) as { data: { id: string; status: string } };
    assert.equal(incPendingBody.data.status, TransactionStatus.PENDING);
    assert.equal(accountsRepo.items[0]?.currentBalance, 880);

    // Filtros via URL + ordenação por valor ascendente + paginação.
    const listRes = await fetch(
      `${baseUrl}?page=1&pageSize=10&type=INCOME&status=PENDING&dateFrom=2026-11-01&dateTo=2026-11-30&search=cliente&sortBy=amount&sortOrder=asc`,
      { headers: { Cookie: ownerCookie } },
    );
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; description: string }>;
      meta: { total: number; pendingIncomeAmount: number; pendingIncomeCount: number };
    };
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.data[0]?.id, incPendingBody.data.id);
    assert.equal(listBody.meta.pendingIncomeAmount, 400);
    assert.equal(listBody.meta.pendingIncomeCount, 1);

    // Anti-IDOR em GET e PATCH confirm.
    const otherGet = await fetch(`${baseUrl}/${incPendingBody.data.id}`, {
      headers: { Cookie: otherCookie },
    });
    assert.equal(otherGet.status, 404);

    // Confirma receita pendente -> saldo 880 + 400 = 1280.
    const confirmRes = await fetch(`${baseUrl}/${incPendingBody.data.id}/confirm`, {
      method: "PATCH",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(accountsRepo.items[0]?.currentBalance, 1280);

    // Reconfirmar retorna 409 CONFLICT.
    const reconfirmRes = await fetch(`${baseUrl}/${incPendingBody.data.id}/confirm`, {
      method: "PATCH",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(reconfirmRes.status, 409);

    // Excluir logicamente despesa confirmada -> estorna +120 -> saldo 1400.
    const deleteRes = await fetch(`${baseUrl}/${expBody.data.id}`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(deleteRes.status, 204);
    assert.equal(accountsRepo.items[0]?.currentBalance, 1400);

    const getDeletedRes = await fetch(`${baseUrl}/${expBody.data.id}`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(getDeletedRes.status, 404);
  });
});
