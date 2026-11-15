import type { PaginationMeta } from "../../../../shared/application/contracts/pagination.contract.js";
import type {
  SortOrder,
  TransactionSortBy,
  TransactionStatus,
  TransactionType,
} from "../../domain/enums/transaction.enums.js";
import type { TransactionListSummary } from "../../domain/interfaces/transaction.interfaces.js";

export interface CreateTransactionDto {
  userId: string;
  accountId: string;
  categoryId?: string | null | undefined;
  description: string;
  amount: number;
  type: TransactionType;
  status?: TransactionStatus | undefined;
  transactionDate: string;
  notes?: string | null | undefined;
}

export interface ListTransactionsQueryDto {
  userId: string;
  page: number;
  pageSize: number;
  offset: number;
  status?: TransactionStatus | undefined;
  type?: TransactionType | undefined;
  accountId?: string | undefined;
  categoryId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  search?: string | undefined;
  sortBy?: TransactionSortBy | undefined;
  sortOrder?: SortOrder | undefined;
}

export interface GetTransactionByIdInputDto {
  userId: string;
  transactionId: string;
}

export interface ConfirmTransactionInputDto {
  userId: string;
  transactionId: string;
}

export interface DeleteTransactionInputDto {
  userId: string;
  transactionId: string;
}

export interface TransactionResponseDto {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  transactionDate: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListMetaSummaryDto extends PaginationMeta, TransactionListSummary {}

export interface PaginatedTransactionsResponseDto {
  items: TransactionResponseDto[];
  meta: TransactionListMetaSummaryDto;
}
