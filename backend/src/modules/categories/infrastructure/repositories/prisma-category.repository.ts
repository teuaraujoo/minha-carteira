import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import { CategoryStatus as PrismaCategoryStatus } from "../../../../../generated/prisma/enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { CategoryMapper, type CategoryRecord } from "../../application/mappers/category.mapper.js";
import { Category } from "../../domain/entities/category.entity.js";
import { CategoryStatus } from "../../domain/enums/category.enums.js";
import type { ICategoryRepository } from "../../domain/interfaces/category-repository.interface.js";
import type { CategoryPaginationQuery, PaginatedCategoriesResult } from "../../domain/interfaces/category.interfaces.js";

export type PrismaCategoryClient = Pick<PrismaClient, "category"> & {
  transaction?: Pick<PrismaClient["transaction"], "count"> | undefined;
};

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaCategoryClient) {}

  async create(category: Category): Promise<Category> {
    try {
      const created = await this.prisma.category.create({
        data: {
          id: category.id,
          userId: category.userId,
          name: category.name,
          color: category.color,
          icon: category.icon,
          isDefault: category.isDefault,
          status: PrismaCategoryStatus[category.status],
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      });
      return CategoryMapper.toEntity(created as CategoryRecord);
    } catch (error) {
      throw mapPrismaCategoryError(error);
    }
  }

  async findAccessibleById(id: string, userId: string): Promise<Category | null> {
    const found = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [{ isDefault: true }, { userId }],
      },
    });
    return found ? CategoryMapper.toEntity(found as CategoryRecord) : null;
  }

  async findByNormalizedNameForUser(
    userId: string,
    normalizedName: string,
    excludeCategoryId?: string,
  ): Promise<Category | null> {
    // Impede duplicação de nomes do próprio usuário (qualquer status) ou de categorias padrão ativas.
    const found = await this.prisma.category.findFirst({
      where: {
        AND: [
          {
            OR: [
              { userId },
              { isDefault: true, status: PrismaCategoryStatus.ACTIVE },
            ],
          },
          ...(excludeCategoryId ? [{ id: { not: excludeCategoryId } }] : []),
          {
            name: {
              equals: normalizedName,
              mode: "insensitive",
            },
          },
        ],
      },
    });
    return found ? CategoryMapper.toEntity(found as CategoryRecord) : null;
  }

  async findManyAccessibleByUserId(query: CategoryPaginationQuery): Promise<PaginatedCategoriesResult> {
    const accessibleWhere: Prisma.CategoryWhereInput = {
      OR: [{ isDefault: true }, { userId: query.userId }],
    };

    const filters: Prisma.CategoryWhereInput[] = [accessibleWhere];
    if (query.status !== undefined) {
      filters.push({ status: PrismaCategoryStatus[query.status] });
    }
    if (query.search) {
      filters.push({
        name: {
          contains: query.search.trim(),
          mode: "insensitive",
        },
      });
    }

    const where: Prisma.CategoryWhereInput = { AND: filters };

    const [records, total, activeCount, inactiveCount, customCount] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { name: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        skip: query.offset,
        take: query.pageSize,
      }),
      this.prisma.category.count({ where }),
      this.prisma.category.count({
        where: {
          AND: [accessibleWhere, { status: PrismaCategoryStatus.ACTIVE }],
        },
      }),
      this.prisma.category.count({
        where: {
          AND: [accessibleWhere, { status: PrismaCategoryStatus.INACTIVE }],
        },
      }),
      this.prisma.category.count({
        where: {
          userId: query.userId,
          isDefault: false,
        },
      }),
    ]);

    return {
      items: records.map((record) => CategoryMapper.toEntity(record as CategoryRecord)),
      total,
      summary: {
        activeCount,
        inactiveCount,
        customCount,
      },
    };
  }

  async update(category: Category): Promise<Category> {
    if (category.isDefault || category.userId === null) {
      throw new AppError({
        status: 403,
        code: ErrorCode.FORBIDDEN,
        message: "Categorias padrão do sistema não podem ser alteradas.",
      });
    }

    try {
      const updated = await this.prisma.category.update({
        where: { id: category.id, userId: category.userId },
        data: {
          name: category.name,
          color: category.color,
          icon: category.icon,
          status: PrismaCategoryStatus[category.status],
          updatedAt: category.updatedAt,
        },
      });
      return CategoryMapper.toEntity(updated as CategoryRecord);
    } catch (error) {
      throw mapPrismaCategoryError(error);
    }
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.category.deleteMany({
        where: {
          id,
          userId,
          isDefault: false,
        },
      });
      return result.count > 0;
    } catch (error) {
      throw mapPrismaCategoryError(error);
    }
  }

  async countLinkedTransactions(categoryId: string, userId: string): Promise<number> {
    if (!this.prisma.transaction) return 0;
    return this.prisma.transaction.count({
      where: {
        categoryId,
        userId,
        deletedAt: null,
      },
    });
  }
}

function mapPrismaCategoryError(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("code" in error)) return error;
  if (error.code === "P2002") {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: "Já existe uma categoria padrão ou personalizada com esse nome.",
      cause: error,
    });
  }
  if (error.code === "P2003") {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: "Esta categoria possui histórico de transações vinculado e não pode ser excluída. Desative-a para preservá-la no histórico.",
      cause: error,
    });
  }
  if (error.code === "P2025") {
    return new AppError({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: "Categoria não encontrada.",
      cause: error,
    });
  }
  return error;
}
