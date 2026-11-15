import type { Category } from "../entities/category.entity.js";
import type { CategoryPaginationQuery, PaginatedCategoriesResult } from "./category.interfaces.js";

export interface ICategoryRepository {
  create(category: Category): Promise<Category>;
  findAccessibleById(id: string, userId: string): Promise<Category | null>;
  findByNormalizedNameForUser(
    userId: string,
    normalizedName: string,
    excludeCategoryId?: string,
  ): Promise<Category | null>;
  findManyAccessibleByUserId(query: CategoryPaginationQuery): Promise<PaginatedCategoriesResult>;
  update(category: Category): Promise<Category>;
  deleteByIdAndUserId(id: string, userId: string): Promise<boolean>;
  countLinkedTransactions(categoryId: string, userId: string): Promise<number>;
}
