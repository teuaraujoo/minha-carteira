"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_ACCOUNT_COLOR,
  type AccountStatus,
  type AccountType,
} from "@/components/accounts/account-catalog";

export type TransactionKind = "INCOME" | "EXPENSE";
export type TransactionStatus = "CONFIRMED" | "PENDING";

export interface AccountTransactionItem {
  id: string;
  accountId: string;
  title: string;
  category: string;
  categoryColor: string;
  kind: TransactionKind;
  status: TransactionStatus;
  amount: number;
  occurredAt: string;
}

export interface AccountMonthlyFlow {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
}

export interface AccountCategorySpend {
  key: string;
  category: string;
  amount: number;
  color: string;
}

export interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  brand: string | null;
  institution: string | null;
  color: string | null;
  initialBalance: number;
  currentBalance: number;
  status: AccountStatus;
  inactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transactionsCount: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  initialBalance: number;
  brand: string | null;
  institution: string | null;
  color: string | null;
}

export interface UpdateAccountInput {
  name: string;
  type: AccountType;
  brand: string | null;
  institution: string | null;
  color: string | null;
}

export const COMPETENCE_MONTHS = [
  { value: "2026-11", label: "Novembro de 2026" },
  { value: "2026-10", label: "Outubro de 2026" },
  { value: "2026-09", label: "Setembro de 2026" },
] as const;

const INITIAL_ACCOUNTS: AccountItem[] = [
  {
    id: "acc-nubank",
    name: "Nubank Principal",
    type: "DIGITAL",
    brand: "mastercard",
    institution: "Nubank",
    color: "#5B21B6",
    initialBalance: 1200.0,
    currentBalance: 4850.9,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: "2026-01-12T10:00:00.000Z",
    updatedAt: "2026-11-14T18:20:00.000Z",
    transactionsCount: 28,
    monthlyIncome: 6250.0,
    monthlyExpense: 3180.4,
  },
  {
    id: "acc-itau",
    name: "Itaú Uniclass",
    type: "CHECKING",
    brand: "hipercard",
    institution: "Itaú",
    color: "#C2410C",
    initialBalance: 3500.0,
    currentBalance: 12430.5,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: "2025-11-04T09:15:00.000Z",
    updatedAt: "2026-11-13T15:10:00.000Z",
    transactionsCount: 41,
    monthlyIncome: 9400.0,
    monthlyExpense: 4215.2,
  },
  {
    id: "acc-reserva",
    name: "Reserva Turquesa",
    type: "SAVINGS",
    brand: "mastercard",
    institution: "Inter",
    color: "#015363",
    initialBalance: 15000.0,
    currentBalance: 22800.0,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: "2025-08-20T14:00:00.000Z",
    updatedAt: "2026-11-10T11:05:00.000Z",
    transactionsCount: 9,
    monthlyIncome: 1850.0,
    monthlyExpense: 0,
  },
  {
    id: "acc-carteira",
    name: "Caixa Econômica",
    type: "CHECKING",
    brand: "elo",
    institution: "Caixa",
    color: "#0F766E",
    initialBalance: 420.0,
    currentBalance: 420.0,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: "2026-11-01T08:30:00.000Z",
    updatedAt: "2026-11-01T08:30:00.000Z",
    transactionsCount: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
  },
  {
    id: "acc-xp",
    name: "XP Renda Fixa",
    type: "INVESTMENT",
    brand: "visa",
    institution: "XP Investimentos",
    color: "#012048",
    initialBalance: 25000.0,
    currentBalance: 31450.0,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: "2025-06-15T12:00:00.000Z",
    updatedAt: "2026-11-09T17:40:00.000Z",
    transactionsCount: 14,
    monthlyIncome: 2450.0,
    monthlyExpense: 400.0,
  },
  {
    id: "acc-santander-old",
    name: "Conta Antiga Universitária",
    type: "CHECKING",
    brand: "elo",
    institution: "Santander",
    color: "#881337",
    initialBalance: 500.0,
    currentBalance: 0,
    status: "INACTIVE",
    inactivatedAt: "2026-09-14T10:30:00.000Z",
    createdAt: "2024-03-10T09:00:00.000Z",
    updatedAt: "2026-09-14T10:30:00.000Z",
    transactionsCount: 12,
    monthlyIncome: 0,
    monthlyExpense: 0,
  },
];

const INITIAL_TRANSACTIONS: AccountTransactionItem[] = [
  {
    id: "tx-1",
    accountId: "acc-nubank",
    title: "Supermercado Zona Sul",
    category: "Alimentação",
    categoryColor: "#015363",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 468.9,
    occurredAt: "2026-11-14",
  },
  {
    id: "tx-2",
    accountId: "acc-nubank",
    title: "Reembolso Consultoria UI",
    category: "Serviços",
    categoryColor: "#00C7C4",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 1450.0,
    occurredAt: "2026-11-12",
  },
  {
    id: "tx-3",
    accountId: "acc-nubank",
    title: "Streaming e Nuvem",
    category: "Assinaturas",
    categoryColor: "#5B21B6",
    kind: "EXPENSE",
    status: "PENDING",
    amount: 119.8,
    occurredAt: "2026-11-16",
  },
  {
    id: "tx-4",
    accountId: "acc-nubank",
    title: "Farmácia São Paulo",
    category: "Saúde",
    categoryColor: "#0F766E",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 184.5,
    occurredAt: "2026-11-08",
  },
  {
    id: "tx-5",
    accountId: "acc-nubank",
    title: "Restaurante Vila Madalena",
    category: "Lazer",
    categoryColor: "#C2410C",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 242.0,
    occurredAt: "2026-11-05",
  },
  {
    id: "tx-6",
    accountId: "acc-itau",
    title: "Salário Mensal",
    category: "Salário",
    categoryColor: "#00C7C4",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 9400.0,
    occurredAt: "2026-11-05",
  },
  {
    id: "tx-7",
    accountId: "acc-itau",
    title: "Aluguel Apartamento",
    category: "Moradia",
    categoryColor: "#012048",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 2450.0,
    occurredAt: "2026-11-06",
  },
  {
    id: "tx-8",
    accountId: "acc-itau",
    title: "Condomínio e Água",
    category: "Moradia",
    categoryColor: "#012048",
    kind: "EXPENSE",
    status: "PENDING",
    amount: 690.0,
    occurredAt: "2026-11-18",
  },
  {
    id: "tx-9",
    accountId: "acc-itau",
    title: "Posto Shell",
    category: "Transporte",
    categoryColor: "#B45309",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 289.4,
    occurredAt: "2026-11-11",
  },
  {
    id: "tx-10",
    accountId: "acc-reserva",
    title: "Aporte Reserva Novembro",
    category: "Poupança",
    categoryColor: "#00C7C4",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 1500.0,
    occurredAt: "2026-11-07",
  },
  {
    id: "tx-11",
    accountId: "acc-reserva",
    title: "Rendimento Mensal",
    category: "Rendimentos",
    categoryColor: "#015363",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 350.0,
    occurredAt: "2026-11-02",
  },
  {
    id: "tx-12",
    accountId: "acc-xp",
    title: "Tesouro Selic 2029",
    category: "Investimentos",
    categoryColor: "#012048",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 2450.0,
    occurredAt: "2026-11-09",
  },
  {
    id: "tx-13",
    accountId: "acc-xp",
    title: "Taxa de Custódia B3",
    category: "Tarifas",
    categoryColor: "#64748B",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 400.0,
    occurredAt: "2026-11-03",
  },
  {
    id: "tx-14",
    accountId: "acc-santander-old",
    title: "Transferência de encerramento",
    category: "Transferências",
    categoryColor: "#881337",
    kind: "EXPENSE",
    status: "CONFIRMED",
    amount: 500.0,
    occurredAt: "2026-09-14",
  },
  {
    id: "tx-15",
    accountId: "acc-santander-old",
    title: "Estorno tarifa bancária",
    category: "Reembolsos",
    categoryColor: "#015363",
    kind: "INCOME",
    status: "CONFIRMED",
    amount: 45.9,
    occurredAt: "2026-09-10",
  },
];

const MONTHLY_FLOW_SERIES: Record<string, AccountMonthlyFlow[]> = {
  "acc-nubank": [
    { monthKey: "2026-06", label: "Jun", income: 4800, expense: 3250 },
    { monthKey: "2026-07", label: "Jul", income: 5100, expense: 2980 },
    { monthKey: "2026-08", label: "Ago", income: 5400, expense: 3690 },
    { monthKey: "2026-09", label: "Set", income: 5900, expense: 3110 },
    { monthKey: "2026-10", label: "Out", income: 6100, expense: 3420 },
    { monthKey: "2026-11", label: "Nov", income: 6250, expense: 3180 },
  ],
  "acc-itau": [
    { monthKey: "2026-06", label: "Jun", income: 8900, expense: 4650 },
    { monthKey: "2026-07", label: "Jul", income: 8900, expense: 4120 },
    { monthKey: "2026-08", label: "Ago", income: 9200, expense: 4890 },
    { monthKey: "2026-09", label: "Set", income: 9200, expense: 4310 },
    { monthKey: "2026-10", label: "Out", income: 9400, expense: 4560 },
    { monthKey: "2026-11", label: "Nov", income: 9400, expense: 4215 },
  ],
  "acc-reserva": [
    { monthKey: "2026-06", label: "Jun", income: 1200, expense: 0 },
    { monthKey: "2026-07", label: "Jul", income: 1350, expense: 0 },
    { monthKey: "2026-08", label: "Ago", income: 1400, expense: 500 },
    { monthKey: "2026-09", label: "Set", income: 1600, expense: 0 },
    { monthKey: "2026-10", label: "Out", income: 1700, expense: 0 },
    { monthKey: "2026-11", label: "Nov", income: 1850, expense: 0 },
  ],
  "acc-xp": [
    { monthKey: "2026-06", label: "Jun", income: 1900, expense: 0 },
    { monthKey: "2026-07", label: "Jul", income: 2100, expense: 250 },
    { monthKey: "2026-08", label: "Ago", income: 1800, expense: 0 },
    { monthKey: "2026-09", label: "Set", income: 2250, expense: 0 },
    { monthKey: "2026-10", label: "Out", income: 2300, expense: 320 },
    { monthKey: "2026-11", label: "Nov", income: 2450, expense: 400 },
  ],
};

const CATEGORY_SPEND_BY_ACCOUNT_MONTH: Record<
  string,
  Record<string, AccountCategorySpend[]>
> = {
  "acc-nubank": {
    "2026-11": [
      { key: "alimentacao", category: "Alimentação", amount: 1280.4, color: "#012048" },
      { key: "lazer", category: "Lazer", amount: 740.0, color: "#015363" },
      { key: "saude", category: "Saúde", amount: 520.0, color: "#00C7C4" },
      { key: "assinaturas", category: "Assinaturas", amount: 380.0, color: "#38BDF8" },
      { key: "outros", category: "Outros", amount: 260.0, color: "#64748B" },
    ],
    "2026-10": [
      { key: "alimentacao", category: "Alimentação", amount: 1410.0, color: "#012048" },
      { key: "lazer", category: "Lazer", amount: 890.0, color: "#015363" },
      { key: "saude", category: "Saúde", amount: 460.0, color: "#00C7C4" },
      { key: "assinaturas", category: "Assinaturas", amount: 360.0, color: "#38BDF8" },
      { key: "outros", category: "Outros", amount: 300.0, color: "#64748B" },
    ],
    "2026-09": [
      { key: "alimentacao", category: "Alimentação", amount: 1190.0, color: "#012048" },
      { key: "lazer", category: "Lazer", amount: 680.0, color: "#015363" },
      { key: "saude", category: "Saúde", amount: 610.0, color: "#00C7C4" },
      { key: "assinaturas", category: "Assinaturas", amount: 350.0, color: "#38BDF8" },
      { key: "outros", category: "Outros", amount: 280.0, color: "#64748B" },
    ],
  },
  "acc-itau": {
    "2026-11": [
      { key: "moradia", category: "Moradia", amount: 3140.0, color: "#012048" },
      { key: "transporte", category: "Transporte", amount: 625.2, color: "#015363" },
      { key: "educacao", category: "Educação", amount: 450.0, color: "#00C7C4" },
    ],
    "2026-10": [
      { key: "moradia", category: "Moradia", amount: 3140.0, color: "#012048" },
      { key: "transporte", category: "Transporte", amount: 820.0, color: "#015363" },
      { key: "educacao", category: "Educação", amount: 600.0, color: "#00C7C4" },
    ],
    "2026-09": [
      { key: "moradia", category: "Moradia", amount: 3140.0, color: "#012048" },
      { key: "transporte", category: "Transporte", amount: 720.0, color: "#015363" },
      { key: "educacao", category: "Educação", amount: 450.0, color: "#00C7C4" },
    ],
  },
  "acc-xp": {
    "2026-11": [{ key: "tarifas", category: "Tarifas", amount: 400.0, color: "#64748B" }],
    "2026-10": [{ key: "tarifas", category: "Tarifas", amount: 320.0, color: "#64748B" }],
  },
  "acc-santander-old": {
    "2026-09": [
      { key: "transferencias", category: "Transferências", amount: 500.0, color: "#881337" },
    ],
  },
};

export interface AccountsStoreSnapshot {
  accounts: AccountItem[];
  transactions: AccountTransactionItem[];
  hideValues: boolean;
}

const SERVER_SNAPSHOT: AccountsStoreSnapshot = {
  accounts: INITIAL_ACCOUNTS,
  transactions: INITIAL_TRANSACTIONS,
  hideValues: false,
};

let storeState: AccountsStoreSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AccountsStoreSnapshot {
  return storeState;
}

function getServerSnapshot(): AccountsStoreSnapshot {
  return SERVER_SNAPSHOT;
}

export function toggleHideAccountValues() {
  storeState = {
    ...storeState,
    hideValues: !storeState.hideValues,
  };
  emitChange();
}

export function createMockAccount(input: CreateAccountInput): {
  ok: true;
  account: AccountItem;
} | {
  ok: false;
  error: string;
} {
  const normalizedName = input.name.trim();
  const duplicate = storeState.accounts.some(
    (item) => item.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicate) {
    return {
      ok: false,
      error: "Já existe uma conta cadastrada com esse nome.",
    };
  }

  const now = new Date().toISOString();
  const slug = normalizedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const newAccount: AccountItem = {
    id: `acc-${slug || "conta"}-${Date.now().toString().slice(-4)}`,
    name: normalizedName,
    type: input.type,
    brand: input.brand,
    institution: input.institution?.trim() || null,
    color: input.color || DEFAULT_ACCOUNT_COLOR,
    initialBalance: input.initialBalance,
    currentBalance: input.initialBalance,
    status: "ACTIVE",
    inactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    transactionsCount: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
  };

  storeState = {
    ...storeState,
    accounts: [newAccount, ...storeState.accounts],
  };
  emitChange();

  return { ok: true, account: newAccount };
}

export function updateMockAccount(
  accountId: string,
  input: UpdateAccountInput,
): {
  ok: true;
  account: AccountItem;
} | {
  ok: false;
  error: string;
} {
  const normalizedName = input.name.trim();
  const duplicate = storeState.accounts.some(
    (item) =>
      item.id !== accountId &&
      item.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicate) {
    return {
      ok: false,
      error: "Já existe outra conta cadastrada com esse nome.",
    };
  }

  let updatedAccount: AccountItem | null = null;
  const now = new Date().toISOString();

  storeState = {
    ...storeState,
    accounts: storeState.accounts.map((item) => {
      if (item.id !== accountId) return item;
      updatedAccount = {
        ...item,
        name: normalizedName,
        type: input.type,
        brand: input.brand,
        institution: input.institution?.trim() || null,
        color: input.color || DEFAULT_ACCOUNT_COLOR,
        updatedAt: now,
      };
      return updatedAccount;
    }),
  };

  if (!updatedAccount) {
    return { ok: false, error: "Conta não encontrada." };
  }

  emitChange();
  return { ok: true, account: updatedAccount };
}

export function toggleMockAccountStatus(accountId: string): AccountItem | null {
  let updatedAccount: AccountItem | null = null;
  const now = new Date().toISOString();

  storeState = {
    ...storeState,
    accounts: storeState.accounts.map((item) => {
      if (item.id !== accountId) return item;
      const nextStatus: AccountStatus =
        item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      updatedAccount = {
        ...item,
        status: nextStatus,
        inactivatedAt: nextStatus === "INACTIVE" ? now : null,
        updatedAt: now,
      };
      return updatedAccount;
    }),
  };

  if (updatedAccount) {
    emitChange();
  }
  return updatedAccount;
}

export function deleteMockAccount(accountId: string): {
  ok: true;
} | {
  ok: false;
  error: string;
} {
  const target = storeState.accounts.find((item) => item.id === accountId);
  if (!target) {
    return { ok: false, error: "Conta não encontrada." };
  }
  if (target.transactionsCount > 0) {
    return {
      ok: false,
      error:
        "Contas com lançamentos vinculados não podem ser excluídas. Desative a conta para preservar o histórico.",
    };
  }

  storeState = {
    ...storeState,
    accounts: storeState.accounts.filter((item) => item.id !== accountId),
    transactions: storeState.transactions.filter((tx) => tx.accountId !== accountId),
  };
  emitChange();
  return { ok: true };
}

export function getAccountMonthlyFlowSeries(
  account: AccountItem,
): AccountMonthlyFlow[] {
  const existing = MONTHLY_FLOW_SERIES[account.id];
  if (existing) return existing;

  return [
    { monthKey: "2026-06", label: "Jun", income: 0, expense: 0 },
    { monthKey: "2026-07", label: "Jul", income: 0, expense: 0 },
    { monthKey: "2026-08", label: "Ago", income: 0, expense: 0 },
    { monthKey: "2026-09", label: "Set", income: 0, expense: 0 },
    { monthKey: "2026-10", label: "Out", income: 0, expense: 0 },
    {
      monthKey: "2026-11",
      label: "Nov",
      income: account.monthlyIncome,
      expense: account.monthlyExpense,
    },
  ];
}

export function getAccountCategorySpend(
  accountId: string,
  monthKey: string,
): AccountCategorySpend[] {
  return CATEGORY_SPEND_BY_ACCOUNT_MONTH[accountId]?.[monthKey] ?? [];
}

export function useAccountsStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
