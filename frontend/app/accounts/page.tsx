"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LayoutGrid,
  Layers,
  Plus,
  Wallet,
} from "lucide-react";

import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { AccountPreviewPanel } from "@/components/accounts/account-preview-panel";
import { AccountWalletStack } from "@/components/accounts/account-wallet-stack";
import {
  toggleHideAccountValues,
  useAccountsStore,
  type AccountItem,
} from "@/components/accounts/accounts-mock-store";
import { AppShell } from "@/components/app-shell";
import { AnimatedMetricNumber } from "@/components/ui/animated-metric-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
type ViewMode = "stack" | "grid";

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, transactions, hideValues } = useAccountsStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [viewMode, setViewMode] = useState<ViewMode>("stack");
  const [selectedId, setSelectedId] = useState<string | null>(
    accounts[0]?.id ?? null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountItem | null>(null);

  const activeAccounts = accounts.filter((item) => item.status === "ACTIVE");
  const inactiveAccounts = accounts.filter((item) => item.status === "INACTIVE");

  const consolidatedActiveBalance = activeAccounts.reduce(
    (sum, item) => sum + item.currentBalance,
    0,
  );

  const filteredAccounts = accounts.filter((item) => {
    if (statusFilter === "ALL") return true;
    return item.status === statusFilter;
  });

  const selectedAccount =
    filteredAccounts.find((item) => item.id === selectedId) ??
    filteredAccounts[0] ??
    null;

  const selectedTransactions = selectedAccount
    ? transactions.filter((tx) => tx.accountId === selectedAccount.id)
    : [];

  const openCreateDialog = () => {
    setAccountToEdit(null);
    setDialogOpen(true);
  };

  const openEditDialog = (account: AccountItem) => {
    setAccountToEdit(account);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <section aria-label="Contas financeiras" className="mx-auto w-full max-w-[1440px] space-y-6">
        {/* Cabeçalho consolidado com saldo total, filtros e ações */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Saldo consolidado (ativas)
                </span>
                <Badge variant="outline">
                  {activeAccounts.length}{" "}
                  {activeAccounts.length === 1 ? "ativa" : "ativas"}
                </Badge>
                {inactiveAccounts.length > 0 ? (
                  <Badge variant="muted">
                    {inactiveAccounts.length}{" "}
                    {inactiveAccounts.length === 1 ? "inativa" : "inativas"}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
                  <AnimatedMetricNumber
                    value={consolidatedActiveBalance}
                    format="currency"
                    hidden={hideValues}
                  />
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleHideAccountValues}
                  aria-label={hideValues ? "Exibir saldos" : "Ocultar saldos"}
                  title={hideValues ? "Exibir saldos" : "Ocultar saldos"}
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
              {/* Filtro de status */}
              <div
                role="group"
                aria-label="Filtrar contas por status"
                className="inline-flex items-center rounded-full border border-border bg-muted/60 p-1"
              >
                {(
                  [
                    { key: "ACTIVE", label: "Ativas" },
                    { key: "INACTIVE", label: "Inativas" },
                    { key: "ALL", label: "Todas" },
                  ] as const
                ).map((option) => {
                  const active = statusFilter === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setStatusFilter(option.key)}
                      aria-pressed={active}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {/* Alternador de visualização Pilha / Grade */}
              <div
                role="group"
                aria-label="Modo de visualização"
                className="inline-flex items-center rounded-full border border-border bg-muted/60 p-1"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("stack")}
                  aria-pressed={viewMode === "stack"}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    viewMode === "stack"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Layers className="size-3.5" aria-hidden="true" />
                  Pilha
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    viewMode === "grid"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  Grade
                </button>
              </div>

              <Button type="button" onClick={openCreateDialog}>
                <Plus className="size-4" aria-hidden="true" />
                Nova conta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Área principal: Pilha/Grade + Prévia da conta */}
        {filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Wallet className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Nenhuma conta encontrada neste filtro
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {statusFilter === "INACTIVE"
                  ? "Você não possui contas desativadas no momento."
                  : "Cadastre sua primeira conta corrente, digital, poupança ou carteira para começar."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {statusFilter !== "ALL" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStatusFilter("ALL")}
                  >
                    Ver todas as contas
                  </Button>
                ) : null}
                <Button type="button" onClick={openCreateDialog}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nova conta
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "stack" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(360px,440px)_1fr] lg:items-start">
            <div className="space-y-3">
              <AccountWalletStack
                accounts={filteredAccounts}
                selectedAccountId={selectedAccount?.id ?? null}
                hideValues={hideValues}
                viewMode="stack"
                onSelectAccount={setSelectedId}
                onOpenAccountDetails={(accountId) =>
                  router.push(`/accounts/${accountId}`)
                }
                onAddAccount={openCreateDialog}
              />
              <p className="text-xs text-muted-foreground lg:hidden">
                Toque no cartão em destaque para abrir a página completa da conta.
              </p>
            </div>

            {selectedAccount ? (
              <AccountPreviewPanel
                account={selectedAccount}
                transactions={selectedTransactions}
                hideValues={hideValues}
                onEdit={openEditDialog}
              />
            ) : null}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(400px,0.95fr)] xl:items-start 2xl:grid-cols-[minmax(0,1.45fr)_minmax(440px,1fr)]">
            <AccountWalletStack
              accounts={filteredAccounts}
              selectedAccountId={selectedAccount?.id ?? null}
              hideValues={hideValues}
              viewMode="grid"
              onSelectAccount={setSelectedId}
              onOpenAccountDetails={(accountId) =>
                router.push(`/accounts/${accountId}`)
              }
              onAddAccount={openCreateDialog}
            />

            {selectedAccount ? (
              <AccountPreviewPanel
                account={selectedAccount}
                transactions={selectedTransactions}
                hideValues={hideValues}
                onEdit={openEditDialog}
              />
            ) : null}
          </div>
        )}
      </section>

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accountToEdit={accountToEdit}
        onSaved={(savedAccount) => {
          setSelectedId(savedAccount.id);
          if (statusFilter === "INACTIVE" && savedAccount.status === "ACTIVE") {
            setStatusFilter("ACTIVE");
          }
        }}
      />
    </AppShell>
  );
}
