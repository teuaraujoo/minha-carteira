import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createApp } from "../../src/app/app.js";
import { createAccountsRouter, Account, AccountStatus, AccountType, AccountsService } from "../../src/modules/accounts/index.js";
import type { IAccountRepository } from "../../src/modules/accounts/domain/interfaces/account-repository.interface.js";
import type { AccountPaginationQuery, PaginatedAccountsResult } from "../../src/modules/accounts/domain/interfaces/account.interfaces.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { JsonWebTokenProvider } from "../../src/modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { createCsrfToken } from "../../src/modules/auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../src/modules/auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const origin = "https://carteira.example";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const ownerSessionId = "33333333-3333-4333-8333-333333333333";
const otherSessionId = "44444444-4444-4444-8444-444444444444";

class HttpMemoryAccountRepository implements IAccountRepository {
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
        const haystacks = [item.name, item.institution ?? "", item.brand ?? ""];
        if (!haystacks.some((value) => value.toLowerCase().includes(needle))) return false;
      }
      return true;
    });
    const active = owned.filter((item) => item.status === AccountStatus.ACTIVE);
    return {
      items: filtered.slice(query.offset, query.offset + query.pageSize),
      total: filtered.length,
      summary: {
        totalBalance: Number(active.reduce((sum, item) => sum + item.currentBalance, 0).toFixed(2)),
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

async function withAccountsServer(
  run: (context: {
    baseUrl: string;
    ownerCookie: string;
    otherCookie: string;
    csrfToken: string;
    repository: HttpMemoryAccountRepository;
  }) => Promise<void>,
): Promise<void> {
  const repository = new HttpMemoryAccountRepository();
  const accountsService = new AccountsService(repository, noopLogger);
  const jwtProvider = new JsonWebTokenProvider("segredo-accounts-http-teste", "minha-carteira-api");

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

  const accountsRouter = createAccountsRouter(
    accountsService,
    jwtProvider,
    refreshTokenRepository,
    userService,
    [origin],
  );
  const app = createApp({
    logger: noopLogger,
    authRouter: Router(),
    usersRouter: Router(),
    accountsRouter,
    allowedOrigins: [origin],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;

  try {
    await run({
      baseUrl: `http://127.0.0.1:${address.port}/api/v1/accounts`,
      ownerCookie: `${AUTH_COOKIE_NAMES.access}=${ownerToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      otherCookie: `${AUTH_COOKIE_NAMES.access}=${otherToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      csrfToken,
      repository,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("rotas /api/v1/accounts exigem autenticação (401) e CSRF nas mutações (403)", async () => {
  await withAccountsServer(async ({ baseUrl, ownerCookie }) => {
    const unauthList = await fetch(baseUrl);
    assert.equal(unauthList.status, 401);

    const noCsrfCreate = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Conta Teste",
        type: AccountType.CHECKING,
        initialBalance: 100,
      }),
    });
    assert.equal(noCsrfCreate.status, 403);
  });
});

test("POST com Origin não autorizado retorna 403", async () => {
  await withAccountsServer(async ({ baseUrl, ownerCookie, csrfToken }) => {
    const badOriginCreate = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: "https://evil.example.com",
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Conta Origem Inválida",
        type: AccountType.CHECKING,
        initialBalance: 100,
      }),
    });
    assert.equal(badOriginCreate.status, 403);
  });
});

test("POST, GET, PATCH, deactivate/reactivate e DELETE /api/v1/accounts seguem contratos globais e anti-IDOR", async () => {
  await withAccountsServer(async ({ baseUrl, ownerCookie, otherCookie, csrfToken, repository }) => {
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Cartão Nubank",
        type: AccountType.DIGITAL,
        initialBalance: 1250.5,
        brand: "mastercard",
        institution: "Nubank",
        color: "#8a05be",
      }),
    });
    assert.equal(createRes.status, 201);
    const createdBody = await createRes.json() as {
      data: {
        id: string;
        name: string;
        initialBalance: number;
        currentBalance: number;
        color: string;
        transactionsCount: number;
      };
    };
    assert.equal(createdBody.data.name, "Cartão Nubank");
    assert.equal(createdBody.data.initialBalance, 1250.5);
    assert.equal(createdBody.data.currentBalance, 1250.5);
    assert.equal(createdBody.data.color, "#8A05BE");
    assert.equal(createdBody.data.transactionsCount, 0);

    // Duplicidade ativa retorna 409 Conflict.
    const dupRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "cartão nubank",
        type: AccountType.CHECKING,
        initialBalance: 0,
      }),
    });
    assert.equal(dupRes.status, 409);

    // Saldo negativo retorna 400 VALIDATION_ERROR.
    const negativeRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Negativa",
        type: AccountType.CASH,
        initialBalance: -1,
      }),
    });
    assert.equal(negativeRes.status, 400);

    // Listagem retorna envelope { data, meta } com paginação global + totalBalance.
    const listRes = await fetch(`${baseUrl}?page=1&pageSize=10&status=ACTIVE`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json() as {
      data: Array<{ id: string }>;
      meta: { page: number; pageSize: number; total: number; totalPages: number; totalBalance: number; activeCount: number; inactiveCount: number };
    };
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.meta.page, 1);
    assert.equal(listBody.meta.pageSize, 10);
    assert.equal(listBody.meta.total, 1);
    assert.equal(listBody.meta.totalBalance, 1250.5);
    assert.equal(listBody.meta.activeCount, 1);
    assert.equal(listBody.meta.inactiveCount, 0);

    // Paginação inválida aciona parsePagination global (400).
    const badPageRes = await fetch(`${baseUrl}?page=0`, { headers: { Cookie: ownerCookie } });
    assert.equal(badPageRes.status, 400);

    // Tentativas de alterar campos proibidos ou enviar payload vazio no PATCH são rejeitadas pelo schema estrito (400).
    for (const invalidPatch of [
      { initialBalance: 9999 },
      { currentBalance: 5000 },
      { status: AccountStatus.INACTIVE },
      { userId: "99999999-9999-4999-8999-999999999999" },
      {},
    ]) {
      const patchInvalidRes = await fetch(`${baseUrl}/${createdBody.data.id}`, {
        method: "PATCH",
        headers: {
          Origin: origin,
          Cookie: ownerCookie,
          "x-csrf-token": csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidPatch),
      });
      assert.equal(patchInvalidRes.status, 400);
    }

    // Parâmetro :accountId inválido retorna 400 VALIDATION_ERROR.
    const invalidIdRes = await fetch(`${baseUrl}/nao-e-uuid`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(invalidIdRes.status, 400);

    // Outro usuário tentando ler, atualizar, alterar status ou excluir recebe 404 (anti-IDOR).
    const otherGetRes = await fetch(`${baseUrl}/${createdBody.data.id}`, {
      headers: { Cookie: otherCookie },
    });
    assert.equal(otherGetRes.status, 404);

    for (const req of [
      { url: `${baseUrl}/${createdBody.data.id}`, method: "PATCH", body: JSON.stringify({ name: "Invadida" }) },
      { url: `${baseUrl}/${createdBody.data.id}/deactivate`, method: "PATCH" },
      { url: `${baseUrl}/${createdBody.data.id}/reactivate`, method: "PATCH" },
      { url: `${baseUrl}/${createdBody.data.id}`, method: "DELETE" },
    ]) {
      const otherMutateRes = await fetch(req.url, {
        method: req.method,
        headers: {
          Origin: origin,
          Cookie: otherCookie,
          "x-csrf-token": csrfToken,
          ...(req.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(req.body ? { body: req.body } : {}),
      });
      assert.equal(otherMutateRes.status, 404);
    }

    // Atualização válida funciona (200).
    const patchRes = await fetch(`${baseUrl}/${createdBody.data.id}`, {
      method: "PATCH",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Nubank Black", brand: "Outros - Alelo", color: null }),
    });
    assert.equal(patchRes.status, 200);
    const patchedBody = await patchRes.json() as { data: { name: string; brand: string; color: string | null } };
    assert.equal(patchedBody.data.name, "Nubank Black");
    assert.equal(patchedBody.data.brand, "Outros - Alelo");
    assert.equal(patchedBody.data.color, null);

    // Renomear outra conta ativa para o mesmo nome retorna 409 Conflict.
    const secondCreateRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Conta Extra",
        type: AccountType.CHECKING,
        initialBalance: 0,
      }),
    });
    assert.equal(secondCreateRes.status, 201);
    const secondCreated = await secondCreateRes.json() as { data: { id: string } };
    const patchDupRes = await fetch(`${baseUrl}/${secondCreated.data.id}`, {
      method: "PATCH",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "nubank black" }),
    });
    assert.equal(patchDupRes.status, 409);

    // Desativar e reativar conta via rotas dedicadas.
    const deactivateRes = await fetch(`${baseUrl}/${createdBody.data.id}/deactivate`, {
      method: "PATCH",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(deactivateRes.status, 200);
    const deactivatedBody = await deactivateRes.json() as { data: { status: string; inactivatedAt: string | null } };
    assert.equal(deactivatedBody.data.status, AccountStatus.INACTIVE);
    assert.ok(deactivatedBody.data.inactivatedAt);

    const reactivateRes = await fetch(`${baseUrl}/${createdBody.data.id}/reactivate`, {
      method: "PATCH",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(reactivateRes.status, 200);

    // Bloqueia DELETE com 409 quando houver transações vinculadas e retorna 204 quando 0.
    repository.linkedTransactions.set(createdBody.data.id, 2);
    const blockedDeleteRes = await fetch(`${baseUrl}/${createdBody.data.id}`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(blockedDeleteRes.status, 409);

    repository.linkedTransactions.set(createdBody.data.id, 0);
    const deleteRes = await fetch(`${baseUrl}/${createdBody.data.id}`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(deleteRes.status, 204);
  });
});
