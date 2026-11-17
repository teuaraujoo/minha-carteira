import type { PaginationMeta } from "../../../../shared/application/contracts/pagination.contract.js";
import type { AccountStatus, AccountType } from "../../domain/enums/account.enums.js";

export interface CreateAccountInputDto {
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  brand?: string | null | undefined;
  institution?: string | null | undefined;
  color?: string | null | undefined;
}

export interface ListAccountsInputDto {
  userId: string;
  page: number;
  pageSize: number;
  offset: number;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
  search?: string | undefined;
}

export interface GetAccountByIdInputDto {
  userId: string;
  accountId: string;
  month?: number | undefined;
  year?: number | undefined;
}

export interface UpdateAccountInputDto {
  userId: string;
  accountId: string;
  name?: string | undefined;
  type?: AccountType | undefined;
  brand?: string | null | undefined;
  institution?: string | null | undefined;
  color?: string | null | undefined;
}

export interface ChangeAccountStatusInputDto {
  userId: string;
  accountId: string;
}

export interface DeleteAccountInputDto {
  userId: string;
  accountId: string;
}

export interface AccountResponseDto {
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
  /** Campo calculado (não persistido em coluna de `accounts`); retorna 0 até a integração com `transactions`. */
  transactionsCount: number;
}

export interface ListAccountsMetaDto extends PaginationMeta {
  totalBalance: number;
  activeCount: number;
  inactiveCount: number;
}

export interface PaginatedAccountsResponseDto {
  items: AccountResponseDto[];
  meta: ListAccountsMetaDto;
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

export interface AccountDetailResponseDto extends AccountResponseDto {
  metrics: AccountDetailMetricsDto;
}
