import type { PaginationInput } from "../../../../shared/application/contracts/pagination.contract.js";
import type { Account } from "../entities/account.entity.js";
import type { AccountStatus, AccountType } from "../enums/account.enums.js";

export interface AccountProps {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  brand: string | null;
  institution: string | null;
  color: string | null;
  initialBalance: number;
  currentBalance: number;
  status: AccountStatus;
  inactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountProps {
  id?: string | undefined;
  userId: string;
  name: string;
  type: AccountType;
  brand?: string | null | undefined;
  institution?: string | null | undefined;
  color?: string | null | undefined;
  initialBalance: number;
  now?: Date | undefined;
}

export interface UpdateAccountDetailsProps {
  name?: string | undefined;
  type?: AccountType | undefined;
  brand?: string | null | undefined;
  institution?: string | null | undefined;
  color?: string | null | undefined;
}

export interface AccountFilter {
  userId: string;
  status?: AccountStatus | undefined;
  type?: AccountType | undefined;
  search?: string | undefined;
}

export interface AccountPaginationQuery extends AccountFilter, PaginationInput {}

export interface AccountListSummary {
  totalBalance: number;
  activeCount: number;
  inactiveCount: number;
}

export interface PaginatedAccountsResult {
  items: Account[];
  total: number;
  summary: AccountListSummary;
}
