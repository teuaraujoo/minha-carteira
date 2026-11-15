"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Pencil,
  Plus,
  ReceiptText,
} from "lucide-react";

import {
  ACCOUNT_TYPE_MAP,
  formatDisplayCurrency,
  resolveAccountBrand,
  resolveCategoryIcon,
} from "@/components/accounts/account-catalog";
import { AccountMetricCard } from "@/components/accounts/account-metric-card";
import type {
  AccountItem,
  AccountTransactionItem,
} from "@/components/accounts/accounts-mock-store";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AccountPreviewPanelProps {
  account: AccountItem;
  transactions: AccountTransactionItem[];
  hideValues: boolean;
  onEdit: (account: AccountItem) => void;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function formatTransactionDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return dateFormatter.format(parsed);
}

export function AccountPreviewPanel({
  account,
  transactions,
  hideValues,
  onEdit,
}: AccountPreviewPanelProps) {
  const typeMeta = ACCOUNT_TYPE_MAP[account.type];
  const brandMeta = resolveAccountBrand(account.brand);
  const latestTransactions = transactions.slice(0, 4);
  const monthlyResult = account.monthlyIncome - account.monthlyExpense;

  return (
    <Card className="h-full justify-between">
      <div>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="truncate text-lg">{account.name}</CardTitle>
                <Badge variant={account.status === "ACTIVE" ? "success" : "warning"}>
                  {account.status === "ACTIVE" ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span>{typeMeta.label}</span>
                {account.institution ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{account.institution}</span>
                  </>
                ) : null}
                {brandMeta ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>Bandeira {brandMeta.label}</span>
                  </>
                ) : null}
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onEdit(account)}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Editar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* Resumo rápido de saldo e fluxo mensal com métricas padronizadas */}
          <div className="@container">
            <div className="grid grid-cols-1 gap-3 @[300px]:grid-cols-2 @[660px]:grid-cols-4">
              <AccountMetricCard
                label="Saldo atual"
                value={account.currentBalance}
                valueFormat="currency"
                hideValue={hideValues}
                tone="neutral"
              />
              <AccountMetricCard
                label="Entradas do mês"
                value={account.monthlyIncome}
                valueFormat="currency"
                hideValue={hideValues}
                tone="positive"
              />
              <AccountMetricCard
                label="Saídas do mês"
                value={account.monthlyExpense}
                valueFormat="currency"
                hideValue={hideValues}
                tone="negative"
              />
              <AccountMetricCard
                label="Resultado do mês"
                value={monthlyResult}
                valueFormat="currency"
                hideValue={hideValues}
                tone={monthlyResult >= 0 ? "positive" : "negative"}
              />
            </div>
          </div>

          {/* Prévia das últimas movimentações */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Últimas movimentações
              </h3>
              <span className="text-xs text-muted-foreground">
                {account.transactionsCount}{" "}
                {account.transactionsCount === 1 ? "lançamento" : "lançamentos"}
              </span>
            </div>

            {latestTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-4 py-7 text-center">
                <ReceiptText
                  className="size-7 text-muted-foreground/70"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Nenhuma movimentação registrada
                </p>
                <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                  Lance uma receita ou despesa nesta conta para acompanhar entradas, saídas e evolução mensal.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70 rounded-xl border border-border/80 bg-background/50">
                {latestTransactions.map((tx) => {
                  const isIncome = tx.kind === "INCOME";
                  const CategoryIcon = resolveCategoryIcon(tx.category);
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
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
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-foreground">
                              {tx.title}
                            </p>
                            {tx.status === "PENDING" ? (
                              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                                <Clock3 className="size-2.5" aria-hidden="true" />
                                Pendente
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className="inline-flex size-4 shrink-0 items-center justify-center rounded-md text-white"
                              style={{ backgroundColor: tx.categoryColor }}
                            >
                              <CategoryIcon className="size-2.5" aria-hidden="true" />
                            </span>
                            <span className="truncate">
                              {tx.category} • {formatTransactionDate(tx.occurredAt)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground",
                        )}
                      >
                        {isIncome ? "+ " : "- "}
                        {formatDisplayCurrency(tx.amount, hideValues)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </div>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/70 pt-4">
        <Link
          href={`/transactions?accountId=${account.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Nova movimentação
        </Link>

        <Link
          href={`/accounts/${account.id}`}
          className={cn(buttonVariants({ variant: "default", size: "sm" }))}
        >
          Ver detalhes completos
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  );
}
