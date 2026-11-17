import type { Account } from "../entities/account.entity.js";
import type {
  AccountDetailMetricsData,
  AccountDetailMetricsQuery,
  AccountPaginationQuery,
  PaginatedAccountsResult,
} from "./account.interfaces.js";

export interface IAccountRepository {
  create(account: Account): Promise<Account>;
  findByIdAndUserId(id: string, userId: string): Promise<Account | null>;
  findActiveByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeAccountId?: string,
  ): Promise<Account | null>;
  findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult>;
  update(account: Account): Promise<Account>;
  deleteByIdAndUserId(id: string, userId: string): Promise<boolean>;
  countLinkedTransactions(accountId: string, userId: string): Promise<number>;
  getDetailMetrics(query: AccountDetailMetricsQuery): Promise<AccountDetailMetricsData>;
}
