"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

import { formatDisplayCurrency } from "@/components/accounts/account-catalog";
import { AccountMetricCard } from "@/components/accounts/account-metric-card";
import {
  confirmMockTransaction,
  deleteMockTransaction,
  toggleHideAccountValues,
  useAccountsStore,
  type AccountTransactionItem,
  type TransactionKind,
  type TransactionStatus,
} from "@/components/accounts/accounts-mock-store";
import { AppShell } from "@/components/app-shell";
import { TRANSACTION_CATEGORIES } from "@/components/transactions/transaction-catalog";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import {
  TransactionsTable,
  type TransactionSortDirection,
  type TransactionSortField,
} from "@/components/transactions/transactions-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilterValue = "ALL" | TransactionStatus;
type SortOptionValue = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const SORT_OPTIONS: Record<SortOptionValue, string> = {
  "date-desc": "Data (mais recente)",
  "date-asc": "Data (mais antiga)",
  "amount-desc": "Valor (maior primeiro)",
  "amount-asc": "Valor (menor primeiro)",
};

export default function TransactionsPage() {
  const { accounts, transactions, hideValues } = useAccountsStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");
  const [accountFilter, setAccountFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOption, setSortOption] = useState<SortOptionValue>("date-desc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<TransactionKind>("INCOME");
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const selectedTransaction = useMemo(
    () =>
      selectedTransactionId
        ? (transactions.find((item) => item.id === selectedTransactionId) ??
          null)
        : null,
    [transactions, selectedTransactionId],
  );

  const selectedTransactionAccount = selectedTransaction
    ? (accountsById.get(selectedTransaction.accountId) ?? null)
    : null;

  const availableCategories = useMemo(() => {
    const unique = new Set<string>();
    TRANSACTION_CATEGORIES.forEach((item) => unique.add(item.name));
    transactions.forEach((tx) => unique.add(tx.category));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [transactions]);

  const statusItemsRecord = useMemo(
    () => ({
      ALL: "Todos os status",
      CONFIRMED: "Confirmada",
      PENDING: "Pendente",
    }),
    [],
  );

  const accountItemsRecord = useMemo(
    () => ({
      ALL: "Todas as contas",
      ...Object.fromEntries(
        accounts.map((account) => [account.id, account.name]),
      ),
    }),
    [accounts],
  );

  const categoryItemsRecord = useMemo(
    () => ({
      ALL: "Todas as categorias",
      ...Object.fromEntries(
        availableCategories.map((category) => [category, category]),
      ),
    }),
    [availableCategories],
  );

  const [sortField, sortDirection] = useMemo<
    [TransactionSortField, TransactionSortDirection]
  >(() => {
    const [field, direction] = sortOption.split("-") as [
      TransactionSortField,
      TransactionSortDirection,
    ];
    return [field, direction];
  }, [sortOption]);

  const filteredAndSortedTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = transactions.filter((tx) => {
      if (statusFilter !== "ALL" && tx.status !== statusFilter) {
        return false;
      }
      if (accountFilter !== "ALL" && tx.accountId !== accountFilter) {
        return false;
      }
      if (categoryFilter !== "ALL" && tx.category !== categoryFilter) {
        return false;
      }
      if (dateFrom && tx.occurredAt < dateFrom) {
        return false;
      }
      if (dateTo && tx.occurredAt > dateTo) {
        return false;
      }
      if (normalizedSearch) {
        const matchesTitle = tx.title.toLowerCase().includes(normalizedSearch);
        const matchesNotes = (tx.notes ?? "")
          .toLowerCase()
          .includes(normalizedSearch);
        if (!matchesTitle && !matchesNotes) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortField === "amount") {
        const diff = a.amount - b.amount;
        if (diff !== 0) {
          return sortDirection === "asc" ? diff : -diff;
        }
      } else {
        const dateCompare = a.occurredAt.localeCompare(b.occurredAt);
        if (dateCompare !== 0) {
          return sortDirection === "asc" ? dateCompare : -dateCompare;
        }
      }

      return b.occurredAt.localeCompare(a.occurredAt);
    });
  }, [
    transactions,
    statusFilter,
    accountFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    searchTerm,
    sortField,
    sortDirection,
  ]);

  const metrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let pendingIncomeCount = 0;
    let pendingIncomeAmount = 0;

    for (const tx of filteredAndSortedTransactions) {
      if (tx.kind === "INCOME") {
        totalIncome += tx.amount;
        if (tx.status === "PENDING") {
          pendingIncomeCount += 1;
          pendingIncomeAmount += tx.amount;
        }
      } else {
        totalExpense += tx.amount;
      }
    }

    return {
      totalIncome,
      totalExpense,
      netResult: totalIncome - totalExpense,
      pendingIncomeCount,
      pendingIncomeAmount,
    };
  }, [filteredAndSortedTransactions]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      statusFilter !== "ALL" ||
      accountFilter !== "ALL" ||
      categoryFilter !== "ALL" ||
      dateFrom ||
      dateTo,
  );

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setAccountFilter("ALL");
    setCategoryFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const handleToggleSort = (field: TransactionSortField) => {
    if (sortField === field) {
      const nextDirection: TransactionSortDirection =
        sortDirection === "desc" ? "asc" : "desc";
      setSortOption(`${field}-${nextDirection}` as SortOptionValue);
      return;
    }

    setSortOption(`${field}-desc` as SortOptionValue);
  };

  const openTransactionDialog = (kind: TransactionKind) => {
    setDialogKind(kind);
    setDialogOpen(true);
  };

  const handleConfirmTransaction = (tx: AccountTransactionItem) => {
    const result = confirmMockTransaction(tx.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Receita "${tx.title}" confirmada.`);
  };

  const handleDeleteTransaction = (tx: AccountTransactionItem) => {
    const result = deleteMockTransaction(tx.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Receita "${tx.title}" excluída.`);
  };

  return (
    <AppShell>
      <section
        aria-label="Transações financeiras"
        className="mx-auto w-full max-w-[1440px] space-y-6"
      >
        {/* Cabeçalho consolidado com ações de lançamento e métricas */}
        <Card size="sm">
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Movimentações financeiras
                  </span>
                  <Badge variant="outline">
                    {filteredAndSortedTransactions.length}{" "}
                    {filteredAndSortedTransactions.length === 1
                      ? "registro"
                      : "registros"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Transações
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleHideAccountValues}
                    aria-label={hideValues ? "Exibir valores" : "Ocultar valores"}
                    title={hideValues ? "Exibir valores" : "Ocultar valores"}
                  >
                    {hideValues ? (
                      <Eye className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  onClick={() => openTransactionDialog("INCOME")}
                  className="bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90"
                >
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  Lançar receita
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openTransactionDialog("EXPENSE")}
                  className="border-rose-500/35 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                >
                  <ArrowDownLeft className="size-4" aria-hidden="true" />
                  Lançar despesa
                </Button>
              </div>
            </div>

            {/* Faixa padronizada de métricas */}
            <div className="@container">
              <div className="grid grid-cols-1 gap-3 @[360px]:grid-cols-2 @[760px]:grid-cols-4">
                <AccountMetricCard
                  label="Entradas"
                  value={formatDisplayCurrency(metrics.totalIncome, hideValues)}
                  tone="positive"
                />
                <AccountMetricCard
                  label="Saídas"
                  value={formatDisplayCurrency(metrics.totalExpense, hideValues)}
                  tone="negative"
                />
                <AccountMetricCard
                  label="Resultado"
                  value={formatDisplayCurrency(metrics.netResult, hideValues)}
                  tone={metrics.netResult >= 0 ? "positive" : "negative"}
                />
                <AccountMetricCard
                  label="Receitas pendentes"
                  value={formatDisplayCurrency(
                    metrics.pendingIncomeAmount,
                    hideValues,
                  )}
                  secondaryValue={
                    metrics.pendingIncomeCount > 0
                      ? `(${metrics.pendingIncomeCount})`
                      : undefined
                  }
                  tone={metrics.pendingIncomeCount > 0 ? "warning" : "neutral"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de filtros e ordenação */}
        <Card size="sm">
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Busca por descrição ou observação */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar descrição ou nota..."
                  aria-label="Buscar por descrição ou observação"
                  className="pl-9"
                />
              </div>

              {/* Filtro por status */}
              <Select
                value={statusFilter}
                items={statusItemsRecord}
                onValueChange={(value) => {
                  if (
                    value === "ALL" ||
                    value === "CONFIRMED" ||
                    value === "PENDING"
                  ) {
                    setStatusFilter(value);
                  }
                }}
              >
                <SelectTrigger aria-label="Filtrar por status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por conta */}
              <Select
                value={accountFilter}
                items={accountItemsRecord}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setAccountFilter(value);
                  }
                }}
              >
                <SelectTrigger aria-label="Filtrar por conta">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro por categoria */}
              <Select
                value={categoryFilter}
                items={categoryItemsRecord}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setCategoryFilter(value);
                  }
                }}
              >
                <SelectTrigger aria-label="Filtrar por categoria">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as categorias</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro por data inicial */}
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="Data inicial"
                title="Data inicial"
              />

              {/* Filtro por data final */}
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="Data final"
                title="Data final"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Exibindo{" "}
                  <strong className="font-semibold text-foreground">
                    {filteredAndSortedTransactions.length}
                  </strong>{" "}
                  de{" "}
                  <strong className="font-semibold text-foreground">
                    {transactions.length}
                  </strong>{" "}
                  transações
                </span>
              </div>

              {/* Limpar filtros e ordenação por data ou valor */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="h-9 gap-1.5"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Limpar filtros
                </Button>

                <span className="text-xs font-medium text-muted-foreground">
                  Ordenar por
                </span>
                <div className="w-52">
                  <Select
                    value={sortOption}
                    items={SORT_OPTIONS}
                    onValueChange={(value) => {
                      if (
                        value === "date-desc" ||
                        value === "date-asc" ||
                        value === "amount-desc" ||
                        value === "amount-asc"
                      ) {
                        setSortOption(value);
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Ordenar transações" className="h-9">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">
                        Data (mais recente)
                      </SelectItem>
                      <SelectItem value="date-asc">
                        Data (mais antiga)
                      </SelectItem>
                      <SelectItem value="amount-desc">
                        Valor (maior primeiro)
                      </SelectItem>
                      <SelectItem value="amount-asc">
                        Valor (menor primeiro)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de transações */}
        <TransactionsTable
          transactions={filteredAndSortedTransactions}
          accountsById={accountsById}
          hideValues={hideValues}
          sortField={sortField}
          sortDirection={sortDirection}
          hasActiveFilters={hasActiveFilters}
          onToggleSort={handleToggleSort}
          onSelectTransaction={(tx) => setSelectedTransactionId(tx.id)}
          onConfirmTransaction={handleConfirmTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onClearFilters={clearFilters}
        />

        {/* Modal de lançamento de receita / despesa */}
        <TransactionFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultKind={dialogKind}
          accounts={accounts}
        />

        {/* Modal de detalhes da transação */}
        <TransactionDetailDialog
          transaction={selectedTransaction}
          account={selectedTransactionAccount}
          hideValues={hideValues}
          open={Boolean(selectedTransaction)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTransactionId(null);
            }
          }}
          onConfirmTransaction={handleConfirmTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />
      </section>
    </AppShell>
  );
}
