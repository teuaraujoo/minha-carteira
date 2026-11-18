"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Power,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  ACCOUNT_TYPE_MAP,
  formatCurrencyBRL,
  formatDisplayCurrency,
  resolveAccountBrand,
  resolveCategoryIcon,
} from "@/components/accounts/account-catalog";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { AccountMetricCard } from "@/components/accounts/account-metric-card";
import { AccountWalletCard } from "@/components/accounts/account-wallet-card";
import { Badge } from "@/components/ui/badge";
import {
  toggleHideValuesPreference,
  useHideValuesPreference,
} from "@/lib/formatters";
import {
  accountsService,
  type AccountDetailDto,
} from "@/services/accounts.service";
import { ApiClientError } from "@/services/api-client";
import {
  categoriesService,
  type CategoryDto,
} from "@/services/categories.service";
import {
  transactionsService,
  type TransactionDto,
} from "@/services/transactions.service";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const cashflowChartConfig = {
  income: {
    label: "Entradas",
    theme: {
      light: "#00A39F",
      dark: "#00C7C4",
    },
  },
  expense: {
    label: "Saídas",
    theme: {
      light: "#012048",
      dark: "#38BDF8",
    },
  },
} satisfies ChartConfig;

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatIsoDatePtBr(isoValue: string | null): string {
  if (!isoValue) return "-";
  const parsed = new Date(isoValue.includes("T") ? isoValue : `${isoValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return monthFormatter.format(parsed);
}

const COMPETENCE_MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function buildRecentCompetenceMonths(count = 6): Array<{ value: string; label: string }> {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const monthNumber = String(monthIndex + 1).padStart(2, "0");
    options.push({
      value: `${monthNumber}/${year}`,
      label: `${COMPETENCE_MONTH_NAMES[monthIndex]} de ${year}`,
    });
  }
  return options;
}

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const hideValues = useHideValuesPreference();
  const competenceOptions = useMemo(() => buildRecentCompetenceMonths(6), []);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    competenceOptions[0]!.value,
  );
  const [account, setAccount] = useState<AccountDetailDto | null>(null);
  const [accountTransactions, setAccountTransactions] = useState<TransactionDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const reloadAccountDetails = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      accountsService.getAccountById(accountId, selectedMonth),
      transactionsService.listTransactions({
        accountId,
        pageSize: 10,
        sortBy: "transactionDate",
        sortOrder: "desc",
      }),
      categoriesService.listCategories({ pageSize: 100 }),
    ])
      .then(([detail, txResult, categoriesResult]) => {
        if (!active) return;
        setNotFound(false);
        setAccount(detail);
        setAccountTransactions(txResult.items);
        setCategories(categoriesResult.items);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiClientError && error.status === 404) {
          setNotFound(true);
          setAccount(null);
        } else if (error instanceof ApiClientError && error.status !== 401) {
          toast.error(error.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accountId, selectedMonth, refreshTick]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  if (loading && !account) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Carregando detalhes da conta...
        </CardContent>
      </Card>
    );
  }

  if (notFound || !account) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Conta não encontrada</CardTitle>
          <CardDescription>
            Esta conta pode ter sido excluída ou o identificador informado não existe nesta carteira.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/accounts" className={cn(buttonVariants({ variant: "default" }))}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar para contas
          </Link>
        </CardContent>
      </Card>
    );
  }

  const typeMeta = ACCOUNT_TYPE_MAP[account.type];
  const brandMeta = resolveAccountBrand(account.brand);
  const { metrics } = account;
  const monthlyFlowSeries = metrics.monthlySeries;
  const categorySpend = metrics.categorySpend;

  const categoryChartConfig = categorySpend.reduce<ChartConfig>((acc, item, index) => {
    const key = item.categoryId ?? `uncategorized-${index}`;
    acc[key] = {
      label: item.name,
      color: item.color ?? "#64748B",
    };
    return acc;
  }, {});

  const categoryChartData = categorySpend.map((item) => ({
    category: item.name,
    amount: item.amount,
    fill: item.color ?? "#64748B",
  }));

  const monthItemsRecord = competenceOptions.reduce<Record<string, string>>(
    (acc, item) => {
      acc[item.value] = item.label;
      return acc;
    },
    {},
  );

  const canPhysicallyDelete = account.transactionsCount === 0;

  const handleToggleStatus = async () => {
    try {
      const updated =
        account.status === "ACTIVE"
          ? await accountsService.deactivateAccount(account.id)
          : await accountsService.reactivateAccount(account.id);

      toast.success(
        updated.status === "INACTIVE"
          ? `Conta "${updated.name}" desativada.`
          : `Conta "${updated.name}" reativada.`,
      );
      reloadAccountDetails();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível alterar o status da conta.",
      );
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await accountsService.deleteAccount(account.id);
      toast.success(`Conta "${account.name}" excluída permanentemente.`);
      setDeleteConfirmOpen(false);
      router.push("/accounts");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível excluir a conta.",
      );
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {/* Breadcrumb e ações rápidas */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1 hover:text-foreground focus-visible:underline focus-visible:outline-none"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Contas
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-foreground">{account.name}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {account.name}
            </h2>
            <Badge variant={account.status === "ACTIVE" ? "success" : "warning"}>
              {account.status === "ACTIVE" ? "Ativa" : "Inativa"}
            </Badge>
            <Badge variant="outline">{typeMeta.label}</Badge>
            {account.institution ? (
              <Badge variant="muted">{account.institution}</Badge>
            ) : null}
            {brandMeta ? <Badge variant="muted">{brandMeta.label}</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleHideValuesPreference}
            aria-label={hideValues ? "Exibir saldos" : "Ocultar saldos"}
            title={hideValues ? "Exibir saldos" : "Ocultar saldos"}
          >
            {hideValues ? (
              <Eye className="size-4" aria-hidden="true" />
            ) : (
              <EyeOff className="size-4" aria-hidden="true" />
            )}
          </Button>

          <Link
            href={`/transactions?accountId=${account.id}`}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              account.status === "INACTIVE" && "pointer-events-none opacity-50",
            )}
            aria-disabled={account.status === "INACTIVE"}
          >
            <Plus className="size-4" aria-hidden="true" />
            Nova movimentação
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Editar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
          >
            <Power className="size-3.5" aria-hidden="true" />
            {account.status === "ACTIVE" ? "Desativar" : "Reativar"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!canPhysicallyDelete}
            title={
              canPhysicallyDelete
                ? "Excluir conta sem lançamentos"
                : "Contas com lançamentos vinculados só podem ser desativadas"
            }
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Banner informativo para conta inativa */}
      {account.status === "INACTIVE" ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                Conta inativa desde {formatIsoDatePtBr(account.inactivatedAt)}
              </p>
              <p className="text-xs opacity-90">
                O histórico de transações e os relatórios continuam disponíveis, mas novos lançamentos ficam bloqueados enquanto a conta estiver inativa.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
          >
            Reativar conta
          </Button>
        </div>
      ) : null}

      {/* Card visual + seletor de competência */}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-stretch">
        <AccountWalletCard account={account} hideValues={hideValues} isFront />

        <div className="flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Calendar className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Competência analisada
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {monthItemsRecord[selectedMonth] ?? selectedMonth}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-56">
              <Select
                value={selectedMonth}
                items={monthItemsRecord}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setSelectedMonth(value);
                  }
                }}
              >
                <SelectTrigger aria-label="Selecionar mês de competência">
                  <SelectValue placeholder="Escolha o mês" />
                </SelectTrigger>
                <SelectContent>
                  {competenceOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Faixa padronizada de 6 KPIs */}
          <div className="@container">
            <div className="grid grid-cols-1 gap-3 @[360px]:grid-cols-2 @[640px]:grid-cols-3">
              <AccountMetricCard
                surface="card"
                label="Saldo atual"
                value={account.currentBalance}
                valueFormat="currency"
                hideValue={hideValues}
                tone="neutral"
              />
              <AccountMetricCard
                surface="card"
                label="Saldo inicial"
                value={account.initialBalance}
                valueFormat="currency"
                hideValue={hideValues}
                tone="neutral"
              />
              <AccountMetricCard
                surface="card"
                label="Entradas do mês"
                value={metrics.income}
                valueFormat="currency"
                hideValue={hideValues}
                tone="positive"
              />
              <AccountMetricCard
                surface="card"
                label="Saídas do mês"
                value={metrics.expense}
                valueFormat="currency"
                hideValue={hideValues}
                tone="negative"
              />
              <AccountMetricCard
                surface="card"
                label="Resultado do mês"
                value={metrics.netResult}
                valueFormat="currency"
                hideValue={hideValues}
                tone={metrics.netResult >= 0 ? "positive" : "negative"}
              />
              <AccountMetricCard
                surface="card"
                label="Mov. pendentes"
                value={metrics.pending.count}
                valueFormat="integer"
                secondaryNumber={{
                  value: metrics.pending.amount,
                  format: "currency",
                  hidden: hideValues,
                  prefix: "(",
                  suffix: ")",
                }}
                tone="warning"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Seção analítica: Gráfico de barras (6 meses) + Gastos por categoria (mês) */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Entradas vs Saídas (últimos 6 meses)</CardTitle>
            <CardDescription>
              Comparativo mensal entre receitas e despesas confirmadas nesta conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={cashflowChartConfig} className="h-[270px] w-full">
              <BarChart
                data={monthlyFlowSeries}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={54}
                  tickFormatter={(value: number) =>
                    hideValues ? "•••" : `R$${Math.round(value / 1000)}k`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex flex-1 items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {name === "income" ? "Entradas" : "Saídas"}
                          </span>
                          <span className="font-mono font-semibold tabular-nums">
                            {typeof value === "number"
                              ? formatDisplayCurrency(value, hideValues)
                              : String(value)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
            <CardDescription>
              Distribuição das saídas em {monthItemsRecord[selectedMonth] ?? selectedMonth}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categorySpend.length === 0 ? (
              <div className="flex h-[270px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  Sem despesas registradas no mês
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quando houver saídas categorizadas nesta competência, a distribuição aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <ChartContainer
                  config={categoryChartConfig}
                  className="mx-auto h-[185px] w-full max-w-[260px]"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name) => (
                            <div className="flex flex-1 items-center justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-mono font-semibold tabular-nums">
                                {typeof value === "number"
                                  ? formatDisplayCurrency(value, hideValues)
                                  : String(value)}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={categoryChartData}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={48}
                      outerRadius={76}
                      strokeWidth={2}
                    />
                  </PieChart>
                </ChartContainer>

                <ul className="space-y-2">
                  {categorySpend.map((item, index) => {
                    const share = Math.round(item.percentage);
                    const CategoryIcon = resolveCategoryIcon(item.name);
                    const categoryColor = item.color ?? "#64748B";
                    return (
                      <li key={item.categoryId ?? `uncat-${index}`} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            <span
                              className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-white"
                              style={{ backgroundColor: categoryColor }}
                            >
                              <CategoryIcon className="size-3" aria-hidden="true" />
                            </span>
                            {item.name}
                          </span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {formatDisplayCurrency(item.amount, hideValues)}{" "}
                            <span className="font-normal text-muted-foreground">
                              ({share}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${share}%`,
                              backgroundColor: categoryColor,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas movimentações da conta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Últimas movimentações da conta</CardTitle>
            <CardDescription>
              Lançamentos recentes vinculados a {account.name} ({account.transactionsCount} no total).
            </CardDescription>
          </div>
          <Link
            href={`/transactions?accountId=${account.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver todas
          </Link>
        </CardHeader>

        <CardContent>
          {accountTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 px-4 py-10 text-center">
              <ReceiptText
                className="size-8 text-muted-foreground/70"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-medium text-foreground">
                Esta conta ainda não possui lançamentos
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Por não possuir movimentações vinculadas, esta conta pode ser excluída fisicamente ou receber seu primeiro lançamento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2.5 font-medium">Descrição</th>
                    <th className="pb-2.5 font-medium">Categoria</th>
                    <th className="pb-2.5 font-medium">Data</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {accountTransactions.map((tx) => {
                    const isIncome = tx.type === "INCOME";
                    const category = tx.categoryId
                      ? categoriesById.get(tx.categoryId)
                      : undefined;
                    const categoryName = category?.name ?? "Sem categoria";
                    const categoryColor = category?.color ?? "#64748B";
                    const CategoryIcon = resolveCategoryIcon(categoryName);
                    return (
                      <tr key={tx.id}>
                        <td className="py-3 pr-3 font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                                isIncome
                                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                              )}
                            </span>
                            <span>{tx.description}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-white"
                              style={{ backgroundColor: categoryColor }}
                            >
                              <CategoryIcon className="size-3" aria-hidden="true" />
                            </span>
                            {categoryName}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground tabular-nums">
                          {formatIsoDatePtBr(tx.transactionDate)}
                        </td>
                        <td className="py-3 pr-3">
                          {tx.status === "CONFIRMED" ? (
                            <Badge variant="success">
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                              Confirmada
                            </Badge>
                          ) : (
                            <Badge variant="warning">
                              <Clock3 className="size-3" aria-hidden="true" />
                              Pendente
                            </Badge>
                          )}
                        </td>
                        <td
                          className={cn(
                            "py-3 text-right font-semibold tabular-nums",
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground",
                          )}
                        >
                          {isIncome ? "+ " : "- "}
                          {formatDisplayCurrency(tx.amount, hideValues)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!canPhysicallyDelete ? (
        <p className="text-xs text-muted-foreground">
          Regra de integridade: esta conta possui {account.transactionsCount} movimentações vinculadas e só pode ser desativada (exclusão física bloqueada).
        </p>
      ) : null}

      <AccountFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        accountToEdit={account}
        onSaved={reloadAccountDetails}
      />

      {/* Confirmação destrutiva apenas quando a conta não possui lançamentos */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir conta permanentemente?</DialogTitle>
            <DialogDescription>
              A conta <strong>{account.name}</strong> (saldo inicial de{" "}
              {formatCurrencyBRL(account.initialBalance)}) ainda não possui movimentações vinculadas e será removida em definitivo.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              autoFocus
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
            >
              Excluir conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
