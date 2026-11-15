import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createApp } from "../../src/app/app.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { JsonWebTokenProvider } from "../../src/modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { createCsrfToken } from "../../src/modules/auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../src/modules/auth/presentation/security/auth-cookies.js";
import {
  CategoriesService,
  Category,
  CategoryStatus,
  createCategoriesRouter,
  type CategoryPaginationQuery,
  type ICategoryRepository,
  type PaginatedCategoriesResult,
} from "../../src/modules/categories/index.js";
import type { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const origin = "https://carteira.example";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const ownerSessionId = "33333333-3333-4333-8333-333333333333";
const otherSessionId = "44444444-4444-4444-8444-444444444444";
const defaultCategoryId = "77000000-0000-4000-8000-000000000001";

class HttpMemoryCategoryRepository implements ICategoryRepository {
  readonly items: Category[] = [
    new Category({
      id: defaultCategoryId,
      userId: null,
      name: "Salário",
      color: "#00C7C4",
      icon: "briefcase",
      isDefault: true,
      status: CategoryStatus.ACTIVE,
      createdAt: new Date("2026-11-15T10:00:00.000Z"),
      updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    }),
  ];
  linkedTransactions = new Map<string, number>();

  async create(category: Category): Promise<Category> {
    this.items.push(category);
    return category;
  }

  async findAccessibleById(id: string, userId: string): Promise<Category | null> {
    return this.items.find((item) => item.id === id && item.isAccessibleBy(userId)) ?? null;
  }

  async findByNormalizedNameForUser(
    userId: string,
    normalizedName: string,
    excludeCategoryId?: string,
  ): Promise<Category | null> {
    return this.items.find((item) =>
      item.id !== excludeCategoryId &&
      item.normalizedName === normalizedName &&
      (item.userId === userId || (item.isDefault && item.status === CategoryStatus.ACTIVE)),
    ) ?? null;
  }

  async findManyAccessibleByUserId(query: CategoryPaginationQuery): Promise<PaginatedCategoriesResult> {
    const accessible = this.items.filter((item) => item.isAccessibleBy(query.userId));
    const filtered = accessible.filter((item) => {
      if (query.status && item.status !== query.status) return false;
      if (query.search && !item.name.toLowerCase().includes(query.search.trim().toLowerCase())) {
        return false;
      }
      return true;
    });

    return {
      items: filtered.slice(query.offset, query.offset + query.pageSize),
      total: filtered.length,
      summary: {
        activeCount: accessible.filter((item) => item.status === CategoryStatus.ACTIVE).length,
        inactiveCount: accessible.filter((item) => item.status === CategoryStatus.INACTIVE).length,
        customCount: accessible.filter((item) => !item.isDefault && item.userId === query.userId).length,
      },
    };
  }

  async update(category: Category): Promise<Category> {
    const index = this.items.findIndex((item) => item.id === category.id);
    if (index >= 0) this.items[index] = category;
    return category;
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    const index = this.items.findIndex(
      (item) => item.id === id && item.userId === userId && !item.isDefault,
    );
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }

  async countLinkedTransactions(categoryId: string): Promise<number> {
    return this.linkedTransactions.get(categoryId) ?? 0;
  }
}

async function withCategoriesServer(
  run: (context: {
    baseUrl: string;
    ownerCookie: string;
    otherCookie: string;
    csrfToken: string;
    repository: HttpMemoryCategoryRepository;
  }) => Promise<void>,
): Promise<void> {
  const repository = new HttpMemoryCategoryRepository();
  const categoriesService = new CategoriesService(repository, noopLogger);
  const jwtProvider = new JsonWebTokenProvider("segredo-categories-http-teste", "minha-carteira-api");
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

  const categoriesRouter = createCategoriesRouter(
    categoriesService,
    jwtProvider,
    refreshTokenRepository,
    userService,
    [origin],
  );
  const app = createApp({
    logger: noopLogger,
    authRouter: Router(),
    usersRouter: Router(),
    categoriesRouter,
    allowedOrigins: [origin],
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;

  try {
    await run({
      baseUrl: `http://127.0.0.1:${address.port}/api/v1/categories`,
      ownerCookie: `${AUTH_COOKIE_NAMES.access}=${ownerToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      otherCookie: `${AUTH_COOKIE_NAMES.access}=${otherToken}; ${AUTH_COOKIE_NAMES.csrf}=${csrfToken}`,
      csrfToken,
      repository,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("rotas /api/v1/categories exigem autenticação (401) e CSRF nas mutações (403)", async () => {
  await withCategoriesServer(async ({ baseUrl, ownerCookie }) => {
    const unauth = await fetch(baseUrl);
    assert.equal(unauth.status, 401);

    const noCsrf = await fetch(baseUrl, {
      method: "POST",
      headers: { Origin: origin, Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Streaming" }),
    });
    assert.equal(noCsrf.status, 403);
  });
});

test("CRUD completo de /api/v1/categories respeita proteção padrão, paginação, vínculos e anti-IDOR", async () => {
  await withCategoriesServer(async ({ baseUrl, ownerCookie, otherCookie, csrfToken, repository }) => {
    // Impede envio de campos não permitidos como isDefault.
    const invalidFieldRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Streaming", isDefault: true }),
    });
    assert.equal(invalidFieldRes.status, 400);

    // Parâmetro de query desconhecido retorna 400.
    const unknownQueryRes = await fetch(`${baseUrl}?foo=bar`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(unknownQueryRes.status, 400);

    // Criação válida.
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Streaming", color: "#5b21b6", icon: "tv" }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { data: { id: string; color: string; isDefault: boolean } };
    assert.equal(created.data.color, "#5B21B6");
    assert.equal(created.data.isDefault, false);

    // Duplicidade retorna 409.
    const dupRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "salário" }),
    });
    assert.equal(dupRes.status, 409);

    // Listagem paginada e filtrada inclui padrão + personalizadas apenas do usuário.
    const listRes = await fetch(`${baseUrl}?page=1&pageSize=10&search=stream`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number; activeCount: number; customCount: number };
    };
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.meta.total, 1);
    assert.equal(listBody.meta.activeCount, 2);
    assert.equal(listBody.meta.customCount, 1);

    // Anti-IDOR: outro usuário recebe 404 ao consultar categoria personalizada alheia.
    const otherGetRes = await fetch(`${baseUrl}/${created.data.id}`, {
      headers: { Cookie: otherCookie },
    });
    assert.equal(otherGetRes.status, 404);

    // Outro usuário consegue ver a categoria padrão do sistema, mas não editá-la (403).
    const defaultGetRes = await fetch(`${baseUrl}/${defaultCategoryId}`, {
      headers: { Cookie: otherCookie },
    });
    assert.equal(defaultGetRes.status, 200);

    const defaultPatchRes = await fetch(`${baseUrl}/${defaultCategoryId}`, {
      method: "PATCH",
      headers: {
        Origin: origin,
        Cookie: ownerCookie,
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Alterada" }),
    });
    assert.equal(defaultPatchRes.status, 403);

    // Desativar, filtrar inativas e reativar.
    const deactivateRes = await fetch(`${baseUrl}/${created.data.id}/deactivate`, {
      method: "PATCH",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(deactivateRes.status, 200);

    const inactiveListRes = await fetch(`${baseUrl}?status=INACTIVE`, {
      headers: { Cookie: ownerCookie },
    });
    const inactiveList = (await inactiveListRes.json()) as { data: Array<{ id: string }> };
    assert.equal(inactiveList.data.length, 1);

    // Exclusão bloqueada quando há transações vinculadas.
    repository.linkedTransactions.set(created.data.id, 1);
    const blockedDeleteRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(blockedDeleteRes.status, 409);

    // Exclusão física quando não há vínculos.
    repository.linkedTransactions.set(created.data.id, 0);
    const deleteRes = await fetch(`${baseUrl}/${created.data.id}`, {
      method: "DELETE",
      headers: { Origin: origin, Cookie: ownerCookie, "x-csrf-token": csrfToken },
    });
    assert.equal(deleteRes.status, 204);
  });
});
