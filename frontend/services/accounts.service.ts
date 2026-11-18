"use client";

import type { AccountStatus, AccountType } from "@/components/accounts/account-catalog";
import { apiRequest } from "@/services/api-client";

export interface AccountDto {
  id: string;
  name: string;
  type: AccountType;
  brand: string | null;
  institution: string | null;
  color: string | null;
  initialBalance: number;
  currentBalance: number;
  status: AccountStatus;
  inactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transactionsCount: number;
}

export interface AccountMonthlySeriesItemDto {
  month: string;
  label: string;
  income: number;
  expense: number;
}

export interface AccountCategorySpendItemDto {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: number;
  percentage: number;
}

export interface AccountDetailMetricsDto {
  month: string;
  income: number;
  expense: number;
  netResult: number;
  projectedBalance: number;
  pending: {
    count: number;
    amount: number;
    incomeAmount: number;
    expenseAmount: number;
  };
  monthlySeries: AccountMonthlySeriesItemDto[];
  categorySpend: AccountCategorySpendItemDto[];
}

export interface AccountDetailDto extends AccountDto {
  metrics: AccountDetailMetricsDto;
}

export interface ListAccountsMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalBalance: number;
  activeCount: number;
  inactiveCount: number;
}

export interface ListAccountsParams {
  page?: number;
  pageSize?: number;
  status?: AccountStatus;
  type?: AccountType;
  search?: string;
}

export interface CreateAccountPayload {
  name: string;
  type: AccountType;
  initialBalance: number;
  brand?: string | null;
  institution?: string | null;
  color?: string | null;
}

export interface UpdateAccountPayload {
  name?: string;
  type?: AccountType;
  brand?: string | null;
  institution?: string | null;
  color?: string | null;
}

export const accountsService = {
  async listAccounts(params: ListAccountsParams = {}) {
    const { data, meta } = await apiRequest<AccountDto[], ListAccountsMetaDto>(
      "/api/v1/accounts",
      {
        query: {
          page: params.page,
          pageSize: params.pageSize,
          status: params.status,
          type: params.type,
          search: params.search,
        },
      },
    );
    return { items: data, meta };
  },

  async getAccountById(accountId: string, month?: string): Promise<AccountDetailDto> {
    const { data } = await apiRequest<AccountDetailDto>(
      `/api/v1/accounts/${accountId}`,
      {
        query: month ? { month } : undefined,
      },
    );
    return data;
  },

  async createAccount(payload: CreateAccountPayload): Promise<AccountDto> {
    const { data } = await apiRequest<AccountDto>("/api/v1/accounts", {
      method: "POST",
      body: payload,
    });
    return data;
  },

  async updateAccount(
    accountId: string,
    payload: UpdateAccountPayload,
  ): Promise<AccountDto> {
    const { data } = await apiRequest<AccountDto>(`/api/v1/accounts/${accountId}`, {
      method: "PATCH",
      body: payload,
    });
    return data;
  },

  async deactivateAccount(accountId: string): Promise<AccountDto> {
    const { data } = await apiRequest<AccountDto>(
      `/api/v1/accounts/${accountId}/deactivate`,
      { method: "PATCH" },
    );
    return data;
  },

  async reactivateAccount(accountId: string): Promise<AccountDto> {
    const { data } = await apiRequest<AccountDto>(
      `/api/v1/accounts/${accountId}/reactivate`,
      { method: "PATCH" },
    );
    return data;
  },

  async deleteAccount(accountId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/accounts/${accountId}`, {
      method: "DELETE",
    });
  },
};
