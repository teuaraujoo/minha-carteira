import type { Category } from "../entities/category.entity.js";
import type { CategoryStatus } from "../enums/category.enums.js";

export interface CategoryProps {
  id: string;
  userId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryProps {
  id?: string | undefined;
  userId: string;
  name: string;
  color?: string | null | undefined;
  icon?: string | null | undefined;
  now?: Date | undefined;
}

export interface UpdateCategoryDetailsProps {
  name?: string | undefined;
  color?: string | null | undefined;
  icon?: string | null | undefined;
}

export interface CategoryFilter {
  userId: string;
  status?: CategoryStatus | undefined;
  search?: string | undefined;
}

export interface CategoryPaginationQuery extends CategoryFilter {
  page: number;
  pageSize: number;
  offset: number;
}

export interface CategoryListSummary {
  activeCount: number;
  inactiveCount: number;
  customCount: number;
}

export interface PaginatedCategoriesResult {
  items: Category[];
  total: number;
  summary: CategoryListSummary;
}
