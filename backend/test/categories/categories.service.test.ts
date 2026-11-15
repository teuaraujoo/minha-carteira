import assert from "node:assert/strict";
import test from "node:test";
import { CategoriesService } from "../../src/modules/categories/application/services/categories.service.js";
import { Category } from "../../src/modules/categories/domain/entities/category.entity.js";
import { CategoryStatus } from "../../src/modules/categories/domain/enums/category.enums.js";
import type { ICategoryRepository } from "../../src/modules/categories/domain/interfaces/category-repository.interface.js";
import type {
  CategoryPaginationQuery,
  PaginatedCategoriesResult,
} from "../../src/modules/categories/domain/interfaces/category.interfaces.js";
import {
  PrismaCategoryRepository,
  type PrismaCategoryClient,
} from "../../src/modules/categories/infrastructure/repositories/prisma-category.repository.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "99999999-9999-4999-8999-999999999999";
const defaultCategoryId = "77000000-0000-4000-8000-000000000007";

class InMemoryCategoryRepository implements ICategoryRepository {
  readonly items: Category[] = [];
  linkedTransactions = new Map<string, number>();

  seed(category: Category): void {
    this.items.push(category);
  }

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
      if (query.search) {
        const needle = query.search.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    const activeCount = accessible.filter((item) => item.status === CategoryStatus.ACTIVE).length;
    const inactiveCount = accessible.filter((item) => item.status === CategoryStatus.INACTIVE).length;
    const customCount = accessible.filter((item) => !item.isDefault && item.userId === query.userId).length;

    return {
      items: filtered.slice(query.offset, query.offset + query.pageSize),
      total: filtered.length,
      summary: { activeCount, inactiveCount, customCount },
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

  async countLinkedTransactions(categoryId: string, _userId: string): Promise<number> {
    return this.linkedTransactions.get(categoryId) ?? 0;
  }
}

function createDefaultCategory(): Category {
  const now = new Date("2026-11-15T10:00:00.000Z");
  return new Category({
    id: defaultCategoryId,
    userId: null,
    name: "Alimentação",
    color: "#015363",
    icon: "utensils",
    isDefault: true,
    status: CategoryStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}

test("CategoriesService impede duplicidade com padrão ou própria categoria e isola por usuário", async () => {
  const repository = new InMemoryCategoryRepository();
  repository.seed(createDefaultCategory());
  const service = new CategoriesService(repository, noopLogger);

  const created = await service.createCategory({
    userId: ownerId,
    name: "Pets",
    color: "#00c7c4",
    icon: "paw-print",
  });
  assert.equal(created.name, "Pets");
  assert.equal(created.color, "#00C7C4");
  assert.equal(created.isDefault, false);

  await assert.rejects(
    service.createCategory({ userId: ownerId, name: "  pets " }),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  await assert.rejects(
    service.createCategory({ userId: ownerId, name: "ALIMENTAÇÃO" }),
    (error: unknown) => error instanceof AppError && error.status === 409,
  );

  // Outro usuário pode criar categoria personalizada com o mesmo nome "Pets".
  const otherCreated = await service.createCategory({ userId: otherUserId, name: "Pets" });
  assert.equal(otherCreated.userId, otherUserId);

  // Isolamento anti-IDOR: owner não enxerga categoria privada de outro usuário.
  await assert.rejects(
    service.getCategoryById({ userId: ownerId, categoryId: otherCreated.id }),
    (error: unknown) => error instanceof AppError && error.status === 404 && error.code === ErrorCode.NOT_FOUND,
  );

  const list = await service.listCategories({
    userId: ownerId,
    page: 1,
    pageSize: 10,
    offset: 0,
  });
  assert.equal(list.items.length, 2);
  assert.equal(list.meta.activeCount, 2);
  assert.equal(list.meta.inactiveCount, 0);
  assert.equal(list.meta.customCount, 1);
});

test("CategoriesService bloqueia mutação em categorias padrão e exclusão com vínculo", async () => {
  const repository = new InMemoryCategoryRepository();
  repository.seed(createDefaultCategory());
  const service = new CategoriesService(repository, noopLogger);

  for (const op of [
    service.updateCategory({ userId: ownerId, categoryId: defaultCategoryId, name: "Outro" }),
    service.deactivateCategory({ userId: ownerId, categoryId: defaultCategoryId }),
    service.reactivateCategory({ userId: ownerId, categoryId: defaultCategoryId }),
    service.deleteCategory({ userId: ownerId, categoryId: defaultCategoryId }),
  ]) {
    await assert.rejects(
      op,
      (error: unknown) => error instanceof AppError && error.status === 403 && error.code === ErrorCode.FORBIDDEN,
    );
  }

  const custom = await service.createCategory({ userId: ownerId, name: "Academia" });
  repository.linkedTransactions.set(custom.id, 2);

  await assert.rejects(
    service.deleteCategory({ userId: ownerId, categoryId: custom.id }),
    (error: unknown) => error instanceof AppError && error.status === 409 && /inativa|desative/i.test(error.message),
  );

  const deactivated = await service.deactivateCategory({ userId: ownerId, categoryId: custom.id });
  assert.equal(deactivated.status, CategoryStatus.INACTIVE);

  const reactivated = await service.reactivateCategory({ userId: ownerId, categoryId: custom.id });
  assert.equal(reactivated.status, CategoryStatus.ACTIVE);

  repository.linkedTransactions.set(custom.id, 0);
  await service.deleteCategory({ userId: ownerId, categoryId: custom.id });

  await assert.rejects(
    service.getCategoryById({ userId: ownerId, categoryId: custom.id }),
    (error: unknown) => error instanceof AppError && error.status === 404,
  );
});

test("PrismaCategoryRepository mapeia erros P2002/P2003/P2025 e conta transações não excluídas", async () => {
  let capturedCountWhere: Record<string, unknown> | undefined;
  let errorCodeToThrow = "P2002";

  const prismaMock = {
    category: {
      create: async () => {
        throw Object.assign(new Error("Unique"), { code: "P2002" });
      },
      findFirst: async () => null,
      findMany: async () => [
        {
          id: defaultCategoryId,
          userId: null,
          name: "Alimentação",
          color: "#015363",
          icon: "utensils",
          isDefault: true,
          status: "ACTIVE",
          createdAt: new Date("2026-11-15T10:00:00.000Z"),
          updatedAt: new Date("2026-11-15T10:00:00.000Z"),
        },
      ],
      count: async () => 1,
      update: async () => {
        throw Object.assign(new Error("Not found"), { code: errorCodeToThrow });
      },
      deleteMany: async () => {
        throw Object.assign(new Error("FK"), { code: "P2003" });
      },
    },
    transaction: {
      count: async (args: { where: Record<string, unknown> }) => {
        capturedCountWhere = args.where;
        return 4;
      },
    },
  } as unknown as PrismaCategoryClient;

  const repository = new PrismaCategoryRepository(prismaMock);
  const custom = Category.create({ userId: ownerId, name: "Cursos" });

  await assert.rejects(
    repository.create(custom),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  errorCodeToThrow = "P2025";
  await assert.rejects(
    repository.update(custom),
    (error: unknown) => error instanceof AppError && error.status === 404 && error.code === ErrorCode.NOT_FOUND,
  );

  await assert.rejects(
    repository.deleteByIdAndUserId(custom.id, ownerId),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );

  const count = await repository.countLinkedTransactions(custom.id, ownerId);
  assert.equal(count, 4);
  assert.deepEqual(capturedCountWhere, { categoryId: custom.id, userId: ownerId, deletedAt: null });
});
