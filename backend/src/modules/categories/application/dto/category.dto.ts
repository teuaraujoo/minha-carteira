import type { PaginationMeta } from "../../../../shared/application/contracts/pagination.contract.js";
import type { CategoryStatus } from "../../domain/enums/category.enums.js";
import type { CategoryListSummary } from "../../domain/interfaces/category.interfaces.js";

export interface CreateCategoryDto {
  userId: string;
  name: string;
  color?: string | null | undefined;
  icon?: string | null | undefined;
}

export interface ListCategoriesQueryDto {
  userId: string;
  page: number;
  pageSize: number;
  offset: number;
  status?: CategoryStatus | undefined;
  search?: string | undefined;
}

export interface GetCategoryByIdInputDto {
  userId: string;
  categoryId: string;
}

export interface UpdateCategoryDto {
  userId: string;
  categoryId: string;
  name?: string | undefined;
  color?: string | null | undefined;
  icon?: string | null | undefined;
}

export interface ChangeCategoryStatusInputDto {
  userId: string;
  categoryId: string;
}

export interface DeleteCategoryInputDto {
  userId: string;
  categoryId: string;
}

export interface CategoryResponseDto {
  id: string;
  userId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListCategoriesMetaDto extends PaginationMeta, CategoryListSummary {}

export interface PaginatedCategoriesResponseDto {
  items: CategoryResponseDto[];
  meta: ListCategoriesMetaDto;
}
