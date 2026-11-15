import assert from "node:assert/strict";
import test from "node:test";
import { AccountsService } from "../../src/modules/accounts/application/services/accounts.service.js";
import { Account, normalizeAccountName } from "../../src/modules/accounts/domain/entities/account.entity.js";
import { AccountStatus, AccountType } from "../../src/modules/accounts/domain/enums/account.enums.js";
import type { IAccountRepository } from "../../src/modules/accounts/domain/interfaces/account-repository.interface.js";
import type { AccountPaginationQuery, PaginatedAccountsResult } from "../../src/modules/accounts/domain/interfaces/account.interfaces.js";
import { PrismaAccountRepository, type PrismaAccountClient } from "../../src/modules/accounts/infrastructure/repositories/prisma-account.repository.js";
import type { AppLogger, LogInput } from "../../src/shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";

class InMemoryAccountRepository implements IAccountRepository {
  readonly items: Account[] = [];
  linkedTransactions = new Map<string, number>();

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
      item.userId === userId
      && item.status === AccountStatus.ACTIVE
      && item.normalizedName === normalizedName
      && item.id !== excludeAccountId,
    ) ?? null;
  }

  async findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult> {
    const owned = this.items.filter((item) => item.userId === query.userId);
    const filtered = owned.filter((item) => {
      if (query.status && item.status !== query.status) return false;
      if (query.type && item.type !== query.type) return false;
      if (query.search) {
        const needle = query.search.trim().toLowerCase();
        const fields = [item.name, item.institution ?? "", item.brand ?? ""];
        if (!fields.some((field) => field.toLowerCase().includes(needle))) return false;
      }
      return true;
    });

    const active = owned.filter((item) => item.status === AccountStatus.ACTIVE);
    const totalBalance = Number(active.reduce((sum, item) => sum + item.currentBalance, 0).toFixed(2));
    return {
      items: filtered.slice(query.offset, query.offset + query.pageSize),
      total: filtered.length,
      summary: {
        totalBalance,
        activeCount: active.length,
        inactiveCount: owned.length - active.length,
      },
    };
  }

  async update(account: Account): Promise<Account> {
    const index = this.items.findIndex((item) => item.id === account.id);
    if (index >= 0) this.items[index] = account;
    return account;
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    const index = this.items.findIndex((item) => item.id === id && item.userId === userId);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }

  async countLinkedTransactions(accountId: string, _userId: string): Promise<number> {
    return this.linkedTransactions.get(accountId) ?? 0;
  }
}

function createFixture() {
  const repository = new InMemoryAccountRepository();
  const logs: Array<{ level: string; input: LogInput }> = [];
  const logger: AppLogger = {
    debug: (input) => { logs.push({ level: "debug", input }); },
    info: (input) => { logs.push({ level: "info", input }); },
    warn: (input) => { logs.push({ level: "warn", input }); },
    error: (input) => { logs.push({ level: "error", input }); },
    fatal: (input) => { logs.push({ level: "fatal", input }); },
    close: async () => undefined,
  };
  return { repository, logs, service: new AccountsService(repository, logger) };
}

test("AccountsService cria conta, bloqueia duplicidade ativa e permite mesmo nome de conta inativa", async () => {
  const { service, logs } = createFixture();

  const created = await service.createAccount({
    userId: ownerId,
    name: "  Nubank Principal ",
    type: AccountType.DIGITAL,
    initialBalance: 1500.75,
    brand: "mastercard",
    institution: "Nubank",
    color: "#8a05be",
  });

  assert.equal(created.name, "Nubank Principal");
  assert.equal(created.initialBalance, 1500.75);
  assert.equal(created.currentBalance, 1500.75);
  assert.equal(created.color, "#8A05BE");
  assert.equal(created.status, AccountStatus.ACTIVE);
  assert.equal(created.transactionsCount, 0);
  assert.equal(logs[0]?.input.event, "accounts.created");

  await assert.rejects(
    service.createAccount({
      userId: ownerId,
      name: "nubank principal",
      type: AccountType.CHECKING,
      initialBalance: 100,
    }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  // Outro usuário pode cadastrar conta com o mesmo nome sem conflito.
  const otherAccount = await service.createAccount({
    userId: otherUserId,
    name: "Nubank Principal",
    type: AccountType.DIGITAL,
    initialBalance: 200,
  });
  assert.equal(normalizeAccountName(otherAccount.name), "nubank principal");

  // Após desativar a primeira conta, um novo cadastro ativo com o mesmo nome é permitido.
  await service.deactivateAccount({ userId: ownerId, accountId: created.id });
  const recreated = await service.createAccount({
    userId: ownerId,
    name: "Nubank Principal",
    type: AccountType.DIGITAL,
    initialBalance: 300,
  });
  assert.equal(recreated.status, AccountStatus.ACTIVE);

  // Nome vazio ou apenas com espaços lança AppError 400 de validação.
  await assert.rejects(
    service.createAccount({
      userId: ownerId,
      name: "   ",
      type: AccountType.CHECKING,
      initialBalance: 0,
    }),
    (error: unknown) => error instanceof AppError && error.status === 400 && error.code === ErrorCode.VALIDATION_ERROR,
  );

  // Renomear outra conta ativa para o mesmo nome também bloqueia com 409.
  const secondActive = await service.createAccount({
    userId: ownerId,
    name: "Itaú Personnalité",
    type: AccountType.CHECKING,
    initialBalance: 100,
  });
  await assert.rejects(
    service.updateAccount({
      userId: ownerId,
      accountId: secondActive.id,
      name: "  nubank principal ",
    }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  // Mas tentar reativar a conta antiga bloqueia com 409 enquanto houver outra ativa homônima.
  await assert.rejects(
    service.reactivateAccount({ userId: ownerId, accountId: created.id }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );
});

test("AccountsService aplica isolamento anti-IDOR, paginação, filtros e resumo totalBalance", async () => {
  const { service } = createFixture();

  const a1 = await service.createAccount({
    userId: ownerId,
    name: "Inter Black",
    type: AccountType.DIGITAL,
    institution: "Banco Inter",
    initialBalance: 1000.25,
  });
  const a2 = await service.createAccount({
    userId: ownerId,
    name: "Reserva XP",
    type: AccountType.INVESTMENT,
    institution: "XP",
    initialBalance: 2500.5,
  });
  await service.createAccount({
    userId: otherUserId,
    name: "Conta Alheia",
    type: AccountType.CHECKING,
    initialBalance: 9999,
  });

  await service.deactivateAccount({ userId: ownerId, accountId: a2.id });

  const list = await service.listAccounts({
    userId: ownerId,
    page: 1,
    pageSize: 10,
    offset: 0,
    status: AccountStatus.ACTIVE,
    search: "inter",
  });

  assert.equal(list.items.length, 1);
  assert.equal(list.items[0]?.id, a1.id);
  assert.equal(list.meta.total, 1);
  assert.equal(list.meta.totalPages, 1);
  // Summary considera todas as contas do usuário autenticado, ignorando conta inativa e contas de terceiros.
  assert.equal(list.meta.totalBalance, 1000.25);
  assert.equal(list.meta.activeCount, 1);
  assert.equal(list.meta.inactiveCount, 1);

  await assert.rejects(
    service.getAccountById({ userId: otherUserId, accountId: a1.id }),
    (error: unknown) => error instanceof AppError && error.status === 404 && error.code === ErrorCode.NOT_FOUND,
  );
  await assert.rejects(
    service.updateAccount({ userId: otherUserId, accountId: a1.id, name: "Invadida" }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
  await assert.rejects(
    service.deleteAccount({ userId: otherUserId, accountId: a1.id }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
});

test("AccountsService bloqueia exclusão quando countLinkedTransactions > 0 e exclui fisicamente quando 0", async () => {
  const { service, repository } = createFixture();

  const account = await service.createAccount({
    userId: ownerId,
    name: "Conta Principal",
    type: AccountType.CHECKING,
    initialBalance: 500,
  });

  repository.linkedTransactions.set(account.id, 3);
  const loaded = await service.getAccountById({ userId: ownerId, accountId: account.id });
  assert.equal(loaded.transactionsCount, 3);

  await assert.rejects(
    service.deleteAccount({ userId: ownerId, accountId: account.id }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  repository.linkedTransactions.set(account.id, 0);
  await service.deleteAccount({ userId: ownerId, accountId: account.id });

  await assert.rejects(
    service.getAccountById({ userId: ownerId, accountId: account.id }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
});

test("PrismaAccountRepository converte Decimal, mapeia P2002/P2025 e preserva saldos no update", async () => {
  let capturedUpdateWhere: Record<string, unknown> | undefined;
  let capturedUpdateData: Record<string, unknown> | undefined;
  let capturedDeleteWhere: Record<string, unknown> | undefined;
  let failUpdateWithP2025 = false;

  const prismaMock = {
    account: {
      create: async () => {
        const error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        throw error;
      },
      findFirst: async () => null,
      findMany: async () => [
        {
          id: "22222222-2222-4222-8222-222222222222",
          userId: ownerId,
          name: "Conta Corrente",
          type: "CHECKING",
          brand: "visa",
          institution: "Banco",
          color: "#012048",
          initialBalance: { toString: () => "100.50" },
          currentBalance: { toString: () => "250.75" },
          status: "ACTIVE",
          inactivatedAt: null,
          createdAt: new Date("2026-11-15T10:00:00.000Z"),
          updatedAt: new Date("2026-11-15T10:00:00.000Z"),
        },
      ],
      count: async () => 1,
      aggregate: async () => ({ _sum: { currentBalance: { toString: () => "250.75" } }, _count: { _all: 1 } }),
      update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        capturedUpdateWhere = args.where;
        if (failUpdateWithP2025) {
          throw Object.assign(new Error("Record to update not found"), { code: "P2025" });
        }
        capturedUpdateData = args.data;
        return {
          id: "22222222-2222-4222-8222-222222222222",
          userId: ownerId,
          name: "Conta Atualizada",
          type: "CHECKING",
          brand: null,
          institution: null,
          color: null,
          initialBalance: "100.50",
          currentBalance: "250.75",
          status: "ACTIVE",
          inactivatedAt: null,
          createdAt: new Date("2026-11-15T10:00:00.000Z"),
          updatedAt: new Date("2026-11-15T10:05:00.000Z"),
        };
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedDeleteWhere = args.where;
        return { count: 1 };
      },
    },
  } as unknown as PrismaAccountClient;

  const repository = new PrismaAccountRepository(prismaMock);
  const entity = Account.create({
    id: "22222222-2222-4222-8222-222222222222",
    userId: ownerId,
    name: "Conta Corrente",
    type: AccountType.CHECKING,
    initialBalance: 100.5,
  });

  await assert.rejects(
    repository.create(entity),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  const list = await repository.findManyByUserId({ userId: ownerId, page: 1, pageSize: 20, offset: 0 });
  assert.equal(list.items[0]?.initialBalance, 100.5);
  assert.equal(list.items[0]?.currentBalance, 250.75);
  assert.equal(list.summary.totalBalance, 250.75);

  await repository.update(entity);
  assert.deepEqual(capturedUpdateWhere, { id: entity.id, userId: ownerId });
  assert.equal(Object.hasOwn(capturedUpdateData ?? {}, "initialBalance"), false);
  assert.equal(Object.hasOwn(capturedUpdateData ?? {}, "currentBalance"), false);

  failUpdateWithP2025 = true;
  await assert.rejects(
    repository.update(entity),
    (error: unknown) => error instanceof AppError && error.status === 404 && error.code === ErrorCode.NOT_FOUND,
  );

  const deleted = await repository.deleteByIdAndUserId(entity.id, ownerId);
  assert.equal(deleted, true);
  assert.deepEqual(capturedDeleteWhere, { id: entity.id, userId: ownerId });
  assert.equal(await repository.countLinkedTransactions(entity.id, ownerId), 0);
});
