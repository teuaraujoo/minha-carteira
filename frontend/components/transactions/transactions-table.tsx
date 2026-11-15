"use client";

import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  FileText,
  Trash2,
} from "lucide-react";

import {
  formatDisplayCurrency,
  resolveCategoryIcon,
} from "@/components/accounts/account-catalog";
import type {
  AccountItem,
  AccountTransactionItem,
} from "@/components/accounts/accounts-mock-store";
import {
  formatTransactionDate,
  TRANSACTION_STATUS_META,
} from "@/components/transactions/transaction-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export type TransactionSortField = "date" | "amount";
export type TransactionSortDirection = "asc" | "desc";

interface TransactionsTableProps {
  transactions: AccountTransactionItem[];
  accountsById: Map<string, AccountItem>;
  hideValues: boolean;
  sortField: TransactionSortField;
  sortDirection: TransactionSortDirection;
  hasActiveFilters: boolean;
  onToggleSort: (field: TransactionSortField) => void;
  onSelectTransaction: (transaction: AccountTransactionItem) => void;
  onConfirmTransaction: (transaction: AccountTransactionItem) => void;
  onDeleteTransaction: (transaction: AccountTransactionItem) => void;
  onClearFilters: () => void;
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: TransactionSortDirection;
}) {
  if (!active) {
    return (
      <ArrowUpDown
        className="size-3.5 text-muted-foreground/70"
        aria-hidden="true"
      />
    );
  }

  return direction === "asc" ? (
    <ArrowUp className="size-3.5 text-primary" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3.5 text-primary" aria-hidden="true" />
  );
}

export function TransactionsTable({
  transactions,
  accountsById,
  hideValues,
  sortField,
  sortDirection,
  hasActiveFilters,
  onToggleSort,
  onSelectTransaction,
  onConfirmTransaction,
  onDeleteTransaction,
  onClearFilters,
}: TransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <Empty className="border-border/80 bg-muted/20 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText className="size-5" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nenhuma transação encontrada</EmptyTitle>
          <EmptyDescription>
            {hasActiveFilters
              ? "Nenhuma movimentação corresponde aos filtros aplicados."
              : "Lance uma receita ou despesa para começar a acompanhar sua movimentação."}
          </EmptyDescription>
        </EmptyHeader>
        {hasActiveFilters ? (
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[780px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-3.5">
              Descrição
            </th>
            <th scope="col" className="px-4 py-3.5">
              Conta
            </th>
            <th scope="col" className="px-4 py-3.5">
              Categoria
            </th>
            <th scope="col" className="px-4 py-3.5">
              Status
            </th>
            <th
              scope="col"
              aria-sort={
                sortField === "date"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="px-4 py-3.5"
            >
              <button
                type="button"
                onClick={() => onToggleSort("date")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Data
                <SortIndicator
                  active={sortField === "date"}
                  direction={sortDirection}
                />
              </button>
            </th>
            <th
              scope="col"
              aria-sort={
                sortField === "amount"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="px-4 py-3.5 text-right"
            >
              <button
                type="button"
                onClick={() => onToggleSort("amount")}
                className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Valor
                <SortIndicator
                  active={sortField === "amount"}
                  direction={sortDirection}
                />
              </button>
            </th>
            <th scope="col" className="w-[152px] px-4 py-3.5 text-right">
              Ações
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border/70">
          {transactions.map((tx) => {
            const isIncome = tx.kind === "INCOME";
            const isPendingIncome = isIncome && tx.status === "PENDING";
            const statusMeta = TRANSACTION_STATUS_META[tx.status];
            const account = accountsById.get(tx.accountId);
            const CategoryIcon = resolveCategoryIcon(tx.category);

            return (
              <tr
                key={tx.id}
                tabIndex={0}
                onClick={() => onSelectTransaction(tx)}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    onSelectTransaction(tx);
                  }
                }}
                aria-label={`Ver detalhes da transação ${tx.title}`}
                className="group cursor-pointer transition-colors hover:bg-muted/35 focus-visible:bg-muted/45 focus-visible:outline-none"
              >
                {/* Descrição e observação opcional (notes) */}
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                        isIncome
                          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      ) : (
                        <ArrowDownLeft className="size-4" aria-hidden="true" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{tx.title}</p>
                      {tx.notes ? (
                        <p
                          title={tx.notes}
                          className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground"
                        >
                          {tx.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>

                {/* Conta */}
                <td className="px-4 py-3.5 align-middle">
                  <div className="inline-flex items-center gap-2 text-sm text-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: account?.color ?? "#64748B" }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {account?.name ?? "Conta removida"}
                    </span>
                  </div>
                </td>

                {/* Categoria */}
                <td className="px-4 py-3.5 align-middle">
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <CategoryIcon
                      className="size-3.5 shrink-0"
                      style={{ color: tx.categoryColor }}
                      aria-hidden="true"
                    />
                    <span>{tx.category}</span>
                  </Badge>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5 align-middle">
                  <Badge variant={statusMeta.badgeVariant}>
                    {statusMeta.label}
                  </Badge>
                </td>

                {/* Data */}
                <td className="px-4 py-3.5 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatTransactionDate(tx.occurredAt)}
                </td>

                {/* Valor */}
                <td
                  className={cn(
                    "px-4 py-3.5 text-right align-middle font-semibold whitespace-nowrap tabular-nums",
                    isIncome
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {isIncome ? "+" : "-"}{" "}
                  {formatDisplayCurrency(tx.amount, hideValues)}
                </td>

                {/* Ações ao passar o mouse em receitas pendentes */}
                <td className="px-4 py-3.5 text-right align-middle">
                  {isPendingIncome ? (
                    <div
                      className={cn(
                        "inline-flex items-center justify-end gap-1.5 transition-opacity duration-150",
                        "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                      )}
                    >
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onConfirmTransaction(tx);
                        }}
                        aria-label={`Confirmar receita ${tx.title}`}
                        title="Confirmar receita"
                        className="border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Confirmar
                      </Button>

                      <Button
                        type="button"
                        size="icon-xs"
                        variant="destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteTransaction(tx);
                        }}
                        aria-label={`Excluir receita ${tx.title}`}
                        title="Excluir receita"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
