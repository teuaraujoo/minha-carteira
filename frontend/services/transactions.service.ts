"use client";

import { apiRequest } from "@/services/api-client";

export type TransactionKind = "INCOME" | "EXPENSE";
export type TransactionStatus = "CONFIRMED" | "PENDING";
export type TransactionSortBy = "transactionDate" | "amount" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface TransactionDto {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  type: TransactionKind;
  status: TransactionStatus;
  transactionDate: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  pendingIncomeAmount: number;
  pendingIncomeCount: number;
}

export interface ListTransactionsParams {
  page?: number;
  pageSize?: number;
  status?: TransactionStatus;
  type?: TransactionKind;
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: TransactionSortBy;
  sortOrder?: SortOrder;
}

export interface CreateTransactionPayload {
  accountId: string;
  categoryId?: string | null;
  description: string;
  amount: number;
  type: TransactionKind;
  status?: TransactionStatus;
  transactionDate: string;
  notes?: string | null;
}

export const transactionsService = {
  async listTransactions(params: ListTransactionsParams = {}) {
    const { data, meta } = await apiRequest<
      TransactionDto[],
      TransactionListMetaDto
    >("/api/v1/transactions", {
      query: {
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        type: params.type,
        accountId: params.accountId,
        categoryId: params.categoryId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
    });
    return { items: data, meta };
  },

  async getTransactionById(transactionId: string): Promise<TransactionDto> {
    const { data } = await apiRequest<TransactionDto>(
      `/api/v1/transactions/${transactionId}`,
    );
    return data;
  },

  async createTransaction(
    payload: CreateTransactionPayload,
  ): Promise<TransactionDto> {
    const { data } = await apiRequest<TransactionDto>("/api/v1/transactions", {
      method: "POST",
      body: payload,
    });
    return data;
  },

  async confirmTransaction(transactionId: string): Promise<TransactionDto> {
    const { data } = await apiRequest<TransactionDto>(
      `/api/v1/transactions/${transactionId}/confirm`,
      { method: "PATCH" },
    );
    return data;
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    await apiRequest<void>(`/api/v1/transactions/${transactionId}`, {
      method: "DELETE",
    });
  },
};
