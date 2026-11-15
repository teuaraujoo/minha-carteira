import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { createPaginationMeta } from "../../../../shared/presentation/http/pagination.js";
import { Category } from "../../domain/entities/category.entity.js";
import type { ICategoryRepository } from "../../domain/interfaces/category-repository.interface.js";
import type { CategoryPaginationQuery } from "../../domain/interfaces/category.interfaces.js";
import type {
  CategoryResponseDto,
  ChangeCategoryStatusInputDto,
  CreateCategoryDto,
  DeleteCategoryInputDto,
  GetCategoryByIdInputDto,
  ListCategoriesQueryDto,
  PaginatedCategoriesResponseDto,
  UpdateCategoryDto,
} from "../dto/category.dto.js";
import { CategoryMapper } from "../mappers/category.mapper.js";

export class CategoriesService {
  constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly logger: AppLogger,
  ) {}

  /** Cria uma categoria personalizada vinculada ao usuário autenticado. */
  async createCategory(input: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = createDomainCategory(input);
    const existing = await this.categoryRepository.findByNormalizedNameForUser(
      input.userId,
      category.normalizedName,
    );
    if (existing) {
      throw duplicateCategoryError();
    }

    const created = await this.categoryRepository.create(category);
    this.logger.info({
      event: "categories.created",
      module: "categories",
      message: "Categoria personalizada criada.",
      context: {
        userId: input.userId,
        categoryId: created.id,
        operation: "createCategory",
      },
    });

    return CategoryMapper.toDto(created);
  }

  /** Lista categorias padrão do sistema e personalizadas do usuário com paginação global. */
  async listCategories(input: ListCategoriesQueryDto): Promise<PaginatedCategoriesResponseDto> {
    const trimmedSearch = input.search?.trim();
    const query: CategoryPaginationQuery = {
      userId: input.userId,
      page: input.page,
      pageSize: input.pageSize,
      offset: input.offset,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
    };

    const result = await this.categoryRepository.findManyAccessibleByUserId(query);
    const pagination = createPaginationMeta(
      { page: input.page, pageSize: input.pageSize, offset: input.offset },
      result.total,
    );

    return {
      items: result.items.map(CategoryMapper.toDto),
      meta: {
        ...pagination,
        ...result.summary,
      },
    };
  }

  /** Retorna uma categoria acessível ao usuário autenticado ou lança 404. */
  async getCategoryById(input: GetCategoryByIdInputDto): Promise<CategoryResponseDto> {
    const category = await this.findAccessibleOrThrow(input.categoryId, input.userId);
    return CategoryMapper.toDto(category);
  }

  /** Atualiza nome, cor ou ícone de uma categoria personalizada do usuário. */
  async updateCategory(input: UpdateCategoryDto): Promise<CategoryResponseDto> {
    if (input.name === undefined && input.color === undefined && input.icon === undefined) {
      throw validationError("Informe ao menos um campo para atualizar a categoria.");
    }

    const category = await this.findAccessibleOrThrow(input.categoryId, input.userId);
    assertCustomEditable(category, "alteradas");

    try {
      category.updateDetails({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      });
    } catch (error) {
      throw mapCategoryDomainError(error);
    }

    if (input.name !== undefined) {
      const duplicate = await this.categoryRepository.findByNormalizedNameForUser(
        input.userId,
        category.normalizedName,
        category.id,
      );
      if (duplicate) {
        throw duplicateCategoryError();
      }
    }

    const updated = await this.categoryRepository.update(category);
    this.logger.info({
      event: "categories.updated",
      module: "categories",
      message: "Categoria personalizada atualizada.",
      context: {
        userId: input.userId,
        categoryId: updated.id,
        operation: "updateCategory",
      },
    });

    return CategoryMapper.toDto(updated);
  }

  /** Desativa uma categoria personalizada preservando lançamentos vinculados. */
  async deactivateCategory(input: ChangeCategoryStatusInputDto): Promise<CategoryResponseDto> {
    const category = await this.findAccessibleOrThrow(input.categoryId, input.userId);
    assertCustomEditable(category, "desativadas");

    try {
      category.deactivate();
    } catch (error) {
      throw mapStatusTransitionError(error);
    }

    const updated = await this.categoryRepository.update(category);
    this.logger.info({
      event: "categories.deactivated",
      module: "categories",
      message: "Categoria personalizada desativada.",
      context: {
        userId: input.userId,
        categoryId: updated.id,
        operation: "deactivateCategory",
      },
    });

    return CategoryMapper.toDto(updated);
  }

  /** Reativa uma categoria personalizada previamente desativada. */
  async reactivateCategory(input: ChangeCategoryStatusInputDto): Promise<CategoryResponseDto> {
    const category = await this.findAccessibleOrThrow(input.categoryId, input.userId);
    assertCustomEditable(category, "reativadas");

    try {
      category.reactivate();
    } catch (error) {
      throw mapStatusTransitionError(error);
    }

    const updated = await this.categoryRepository.update(category);
    this.logger.info({
      event: "categories.reactivated",
      module: "categories",
      message: "Categoria personalizada reativada.",
      context: {
        userId: input.userId,
        categoryId: updated.id,
        operation: "reactivateCategory",
      },
    });

    return CategoryMapper.toDto(updated);
  }

  /** Exclui fisicamente uma categoria personalizada quando não houver transações vinculadas. */
  async deleteCategory(input: DeleteCategoryInputDto): Promise<void> {
    const category = await this.findAccessibleOrThrow(input.categoryId, input.userId);
    assertCustomEditable(category, "excluídas");

    const linkedTransactions = await this.categoryRepository.countLinkedTransactions(
      category.id,
      input.userId,
    );
    if (linkedTransactions > 0) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "Esta categoria possui transações vinculadas e não pode ser excluída. Desative-a para preservá-la no histórico.",
      });
    }

    const deleted = await this.categoryRepository.deleteByIdAndUserId(category.id, input.userId);
    if (!deleted) {
      throw categoryNotFoundError();
    }

    this.logger.info({
      event: "categories.deleted",
      module: "categories",
      message: "Categoria personalizada excluída.",
      context: {
        userId: input.userId,
        categoryId: category.id,
        operation: "deleteCategory",
      },
    });
  }

  private async findAccessibleOrThrow(categoryId: string, userId: string): Promise<Category> {
    const category = await this.categoryRepository.findAccessibleById(categoryId, userId);
    if (!category || !category.isAccessibleBy(userId)) {
      throw categoryNotFoundError();
    }
    return category;
  }
}

function createDomainCategory(input: CreateCategoryDto): Category {
  try {
    return Category.create({
      userId: input.userId,
      name: input.name,
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
    });
  } catch (error) {
    throw mapCategoryDomainError(error);
  }
}

function assertCustomEditable(category: Category, actionPlural: string): void {
  if (category.isDefault) {
    throw new AppError({
      status: 403,
      code: ErrorCode.FORBIDDEN,
      message: `Categorias padrão do sistema não podem ser ${actionPlural}.`,
    });
  }
}

function mapStatusTransitionError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError || error instanceof RangeError) {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

function mapCategoryDomainError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError || error instanceof RangeError) {
    return new AppError({
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

function validationError(message: string): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
  });
}

function duplicateCategoryError(): AppError {
  return new AppError({
    status: 409,
    code: ErrorCode.CONFLICT,
    message: "Já existe uma categoria padrão ou personalizada com esse nome.",
  });
}

function categoryNotFoundError(): AppError {
  return new AppError({
    status: 404,
    code: ErrorCode.NOT_FOUND,
    message: "Categoria não encontrada.",
  });
}
