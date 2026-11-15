export const TransactionType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  CONFIRMED: "CONFIRMED",
  PENDING: "PENDING",
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TransactionSortBy = {
  TRANSACTION_DATE: "transactionDate",
  AMOUNT: "amount",
} as const;

export type TransactionSortBy = (typeof TransactionSortBy)[keyof typeof TransactionSortBy];

export const SortOrder = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
