import type { Transaction } from "../entities/transaction.entity.js";
import type { PaginatedTransactionsResult, TransactionPaginationQuery } from "./transaction.interfaces.js";

export interface ITransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  findByIdAndUserId(id: string, userId: string): Promise<Transaction | null>;
  findManyByUserId(query: TransactionPaginationQuery): Promise<PaginatedTransactionsResult>;
  confirm(transaction: Transaction): Promise<Transaction>;
  softDelete(transaction: Transaction): Promise<boolean>;
}
