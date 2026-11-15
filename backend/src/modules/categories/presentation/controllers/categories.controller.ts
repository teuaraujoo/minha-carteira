import type { Request, Response } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { parsePagination } from "../../../../shared/presentation/http/pagination.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { CategoriesService } from "../../application/services/categories.service.js";
import {
  categoryIdParamSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../schemas/categories.schemas.js";

export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const pagination = parsePagination({
      page: request.query.page,
      pageSize: request.query.pageSize,
    });

    const parsedQuery = listCategoriesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      throw validationError("Parâmetros de consulta de categorias inválidos.", parsedQuery.error);
    }

    const result = await this.categoriesService.listCategories({
      userId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      offset: pagination.offset,
      ...(parsedQuery.data.status !== undefined ? { status: parsedQuery.data.status } : {}),
      ...(parsedQuery.data.search !== undefined && parsedQuery.data.search.length > 0
        ? { search: parsedQuery.data.search }
        : {}),
    });

    sendSuccess(response, result.items, result.meta);
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const parsedBody = createCategorySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw validationError("Dados de criação da categoria inválidos.", parsedBody.error);
    }

    const created = await this.categoriesService.createCategory({
      userId,
      name: parsedBody.data.name,
      ...(parsedBody.data.color !== undefined ? { color: parsedBody.data.color } : {}),
      ...(parsedBody.data.icon !== undefined ? { icon: parsedBody.data.icon } : {}),
    });

    sendCreated(response, created);
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const categoryId = parseCategoryIdParam(request);
    const category = await this.categoriesService.getCategoryById({ userId, categoryId });
    sendSuccess(response, category);
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const categoryId = parseCategoryIdParam(request);
    const parsedBody = updateCategorySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw validationError("Dados de atualização da categoria inválidos.", parsedBody.error);
    }

    const updated = await this.categoriesService.updateCategory({
      userId,
      categoryId,
      ...(parsedBody.data.name !== undefined ? { name: parsedBody.data.name } : {}),
      ...(parsedBody.data.color !== undefined ? { color: parsedBody.data.color } : {}),
      ...(parsedBody.data.icon !== undefined ? { icon: parsedBody.data.icon } : {}),
    });

    sendSuccess(response, updated);
  };

  deactivate = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const categoryId = parseCategoryIdParam(request);
    const updated = await this.categoriesService.deactivateCategory({ userId, categoryId });
    sendSuccess(response, updated);
  };

  reactivate = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const categoryId = parseCategoryIdParam(request);
    const updated = await this.categoriesService.reactivateCategory({ userId, categoryId });
    sendSuccess(response, updated);
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const categoryId = parseCategoryIdParam(request);
    await this.categoriesService.deleteCategory({ userId, categoryId });
    sendNoContent(response);
  };
}

function requireUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new AppError({
      status: 401,
      code: ErrorCode.UNAUTHORIZED,
      message: "Autenticação inválida ou expirada.",
    });
  }
  return userId;
}

function parseCategoryIdParam(request: Request): string {
  const parsed = categoryIdParamSchema.safeParse(request.params);
  if (!parsed.success) {
    throw validationError("ID da categoria inválido.", parsed.error);
  }
  return parsed.data.categoryId;
}

function validationError(message: string, cause: unknown): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
    cause,
  });
}
