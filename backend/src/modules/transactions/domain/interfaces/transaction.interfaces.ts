import type { Transaction } from "../entities/transaction.entity.js";
import type {
  SortOrder,
  TransactionSortBy,
  TransactionStatus,
  TransactionType,
} from "../enums/transaction.enums.js";

export interface TransactionProps {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  transactionDate: string;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTransactionProps {
  id?: string | undefined;
  userId: string;
  accountId: string;
  categoryId?: string | null | undefined;
  description: string;
  amount: number;
  type: TransactionType;
  status?: TransactionStatus | undefined;
  transactionDate: string;
  notes?: string | null | undefined;
  now?: Date | undefined;
}

export interface TransactionFilter {
  userId: string;
  status?: TransactionStatus | undefined;
  type?: TransactionType | undefined;
  accountId?: string | undefined;
  categoryId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  search?: string | undefined;
}

export interface TransactionPaginationQuery extends TransactionFilter {
  page: number;
  pageSize: number;
  offset: number;
  sortBy: TransactionSortBy;
  sortOrder: SortOrder;
}

export interface TransactionListSummary {
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  pendingIncomeAmount: number;
  pendingIncomeCount: number;
}

export interface PaginatedTransactionsResult {
  items: Transaction[];
  total: number;
  summary: TransactionListSummary;
}
