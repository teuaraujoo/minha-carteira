"use client";

import type { CategoryStatus } from "@/components/categories/category-catalog";
import { apiRequest } from "@/services/api-client";

export interface CategoryDto {
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

export interface ListCategoriesMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  customCount: number;
}

export interface ListCategoriesParams {
  page?: number;
  pageSize?: number;
  status?: CategoryStatus;
  search?: string;
}

export interface CreateCategoryPayload {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

export const categoriesService = {
  async listCategories(params: ListCategoriesParams = {}) {
    const { data, meta } = await apiRequest<CategoryDto[], ListCategoriesMetaDto>(
      "/api/v1/categories",
      {
        query: {
          page: params.page,
          pageSize: params.pageSize,
          status: params.status,
          search: params.search,
        },
      },
    );
    return { items: data, meta };
  },

  async getCategoryById(categoryId: string): Promise<CategoryDto> {
    const { data } = await apiRequest<CategoryDto>(
      `/api/v1/categories/${categoryId}`,
    );
    return data;
  },

  async createCategory(payload: CreateCategoryPayload): Promise<CategoryDto> {
    const { data } = await apiRequest<CategoryDto>("/api/v1/categories", {
      method: "POST",
      body: payload,
    });
    return data;
  },

  async updateCategory(
    categoryId: string,
    payload: UpdateCategoryPayload,
  ): Promise<CategoryDto> {
    const { data } = await apiRequest<CategoryDto>(
      `/api/v1/categories/${categoryId}`,
      {
        method: "PATCH",
        body: payload,
      },
    );
    return data;
  },

  async deactivateCategory(categoryId: string): Promise<CategoryDto> {
    const { data } = await apiRequest<CategoryDto>(
      `/api/v1/categories/${categoryId}/deactivate`,
      { method: "PATCH" },
    );
    return data;
  },

  async reactivateCategory(categoryId: string): Promise<CategoryDto> {
    const { data } = await apiRequest<CategoryDto>(
      `/api/v1/categories/${categoryId}/reactivate`,
      { method: "PATCH" },
    );
    return data;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/categories/${categoryId}`, {
      method: "DELETE",
    });
  },
};
