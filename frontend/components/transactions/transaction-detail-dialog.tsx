"use client";

import { createElement } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  FileText,
  Landmark,
  Trash2,
} from "lucide-react";

import {
  formatDisplayCurrency,
  resolveCategoryIcon,
} from "@/components/accounts/account-catalog";
import { TRANSACTION_STATUS_META } from "@/components/transactions/transaction-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AccountDto } from "@/services/accounts.service";
import type { CategoryDto } from "@/services/categories.service";
import type { TransactionDto } from "@/services/transactions.service";

interface TransactionDetailDialogProps {
  transaction: TransactionDto | null;
  account: AccountDto | null;
  category: CategoryDto | null;
  hideValues: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmTransaction: (transaction: TransactionDto) => void;
  onDeleteTransaction: (transaction: TransactionDto) => void;
}

function formatLongTransactionDate(dateString: string): string {
  const parsed = parseISO(dateString);
  if (!isValid(parsed)) return dateString;
  return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function TransactionDetailDialog({
  transaction,
  account,
  category,
  hideValues,
  open,
  onOpenChange,
  onConfirmTransaction,
  onDeleteTransaction,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  const isIncome = transaction.type === "INCOME";
  const isPendingIncome = isIncome && transaction.status === "PENDING";
  const statusMeta = TRANSACTION_STATUS_META[transaction.status];
  const categoryName = category?.name ?? "Sem categoria";
  const categoryColor = category?.color ?? "#64748B";

  const handleConfirm = () => {
    onConfirmTransaction(transaction);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDeleteTransaction(transaction);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isIncome ? "success" : "destructive"}
              className="gap-1"
            >
              {isIncome ? (
                <ArrowUpRight className="size-3" aria-hidden="true" />
              ) : (
                <ArrowDownLeft className="size-3" aria-hidden="true" />
              )}
              {isIncome ? "Receita (Entrada)" : "Despesa (Saída)"}
            </Badge>
            <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
          </div>

          <DialogTitle className="pt-1 text-xl">
            {transaction.description}
          </DialogTitle>
          <DialogDescription>
            Detalhes completos do lançamento financeiro selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bloco de valor em destaque */}
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Valor da transação
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
                isIncome
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {isIncome ? "+" : "-"}{" "}
              {formatDisplayCurrency(transaction.amount, hideValues)}
            </p>
          </div>

          {/* Metadados principais */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-background/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Conta</p>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: account?.color ?? "#64748B" }}
                  aria-hidden="true"
                />
                <Landmark
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {account?.name ?? "Conta removida"}
                </span>
              </div>
              {account?.institution ? (
                <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
                  {account.institution}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border/80 bg-background/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Categoria
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                {createElement(resolveCategoryIcon(categoryName), {
                  className: "size-4 shrink-0",
                  style: { color: categoryColor },
                  "aria-hidden": true,
                })}
                <span className="truncate">{categoryName}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/60 p-3 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                Data da transação
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarDays
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{formatLongTransactionDate(transaction.transactionDate)}</span>
              </div>
            </div>
          </div>

          {/* Observação (notes) */}
          <div className="rounded-xl border border-border/80 bg-background/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="size-3.5" aria-hidden="true" />
              Observações (notes)
            </div>
            <p
              className={cn(
                "mt-1.5 text-sm leading-relaxed",
                transaction.notes
                  ? "text-foreground"
                  : "italic text-muted-foreground",
              )}
            >
              {transaction.notes || "Nenhuma observação registrada para este lançamento."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {isPendingIncome ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirm}
                className="border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <Check className="size-4" aria-hidden="true" />
                Confirmar receita
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Excluir
              </Button>
            </div>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
