"use client";

import type { KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { AccountWalletCard } from "@/components/accounts/account-wallet-card";
import type { AccountDto } from "@/services/accounts.service";
import { cn } from "@/lib/utils";

interface AccountWalletStackProps {
  accounts: AccountDto[];
  selectedAccountId: string | null;
  hideValues: boolean;
  viewMode: "stack" | "grid";
  onSelectAccount: (accountId: string) => void;
  onOpenAccountDetails: (accountId: string) => void;
  onAddAccount: () => void;
}

const CARD_HEIGHT = 218;

export function AccountWalletStack({
  accounts,
  selectedAccountId,
  hideValues,
  viewMode,
  onSelectAccount,
  onOpenAccountDetails,
  onAddAccount,
}: AccountWalletStackProps) {
  const prefersReducedMotion = useReducedMotion();

  if (accounts.length === 0) {
    return null;
  }

  if (viewMode === "grid") {
    return (
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @[510px]:grid-cols-2">
          {accounts.map((account) => {
            const isSelected = account.id === selectedAccountId;
            return (
              <div
                key={account.id}
                className={cn(
                  "group relative rounded-[26px] p-1 transition-all",
                  isSelected
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-background"
                    : "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                )}
              >
                <AccountWalletCard
                  account={account}
                  hideValues={hideValues}
                  isFront={isSelected}
                  isSelected={isSelected}
                  onSelect={() => onSelectAccount(account.id)}
                  ariaLabel={`Selecionar conta ${account.name}`}
                />
                <button
                  type="button"
                  onClick={() => onOpenAccountDetails(account.id)}
                  className={cn(
                    "mt-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <span className="truncate">Abrir detalhes de {account.name}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const resolvedSelectedId =
    accounts.some((item) => item.id === selectedAccountId)
      ? selectedAccountId
      : accounts[0].id;

  const selectedAccount =
    accounts.find((item) => item.id === resolvedSelectedId) ?? accounts[0];
  const backAccounts = accounts.filter((item) => item.id !== selectedAccount.id);
  const orderedStack = [...backAccounts, selectedAccount];

  const peekOffset = orderedStack.length > 5 ? 40 : 48;
  const totalHeight = (orderedStack.length - 1) * peekOffset + CARD_HEIGHT;

  const handleKeyNavigation = (event: KeyboardEvent<HTMLDivElement>) => {
    if (orderedStack.length <= 1) return;
    const currentIndex = accounts.findIndex((item) => item.id === selectedAccount.id);
    if (currentIndex === -1) return;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = accounts[(currentIndex + 1) % accounts.length];
      onSelectAccount(next.id);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = accounts[(currentIndex - 1 + accounts.length) % accounts.length];
      onSelectAccount(prev.id);
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="region"
        aria-label="Carteira empilhada de contas"
        onKeyDown={handleKeyNavigation}
        className="relative w-full"
        style={{ height: `${totalHeight}px` }}
      >
        {orderedStack.map((account, index) => {
          const isFront = index === orderedStack.length - 1;
          const topOffset = index * peekOffset;
          const horizontalInset = isFront ? 0 : Math.min((orderedStack.length - 1 - index) * 4, 14);

          return (
            <motion.div
              key={account.id}
              layout={!prefersReducedMotion}
              initial={false}
              animate={{
                top: topOffset,
                left: horizontalInset,
                right: horizontalInset,
                scale: isFront ? 1 : Math.max(0.94, 1 - (orderedStack.length - 1 - index) * 0.015),
              }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 320, damping: 28 }
              }
              style={{ zIndex: index + 1 }}
              className="absolute"
            >
              <AccountWalletCard
                account={account}
                hideValues={hideValues}
                isFront={isFront}
                isSelected={isFront}
                showAddNotch={isFront}
                onAddAccount={onAddAccount}
                onSelect={() => {
                  if (!isFront) {
                    onSelectAccount(account.id);
                    return;
                  }
                  // No mobile, tocar no cartão em destaque abre diretamente a tela da conta.
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    onOpenAccountDetails(account.id);
                  }
                }}
                ariaLabel={
                  isFront
                    ? `Conta em destaque: ${account.name}. Pressione as setas para alternar entre contas.`
                    : `Trazer conta ${account.name} para frente`
                }
              />
            </motion.div>
          );
        })}
      </div>

      {/* Atalhos rápidos por teclado e toque quando houver múltiplas contas */}
      {accounts.length > 1 ? (
        <div
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Seleção rápida de contas"
        >
          {accounts.map((account) => {
            const active = account.id === selectedAccount.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelectAccount(account.id)}
                aria-pressed={active}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {account.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
