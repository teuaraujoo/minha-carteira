"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_ACCOUNT_COLOR } from "@/components/accounts/account-catalog";
import type { CategoryStatus } from "@/components/categories/category-catalog";

export interface CategoryItem {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon: string;
  status?: CategoryStatus;
}

export interface UpdateCategoryInput {
  name: string;
  color: string;
  icon: string;
  status: CategoryStatus;
}

const INITIAL_CATEGORIES: CategoryItem[] = [
  {
    id: "cat-default-salario",
    userId: null,
    name: "Salário",
    color: "#00C7C4",
    icon: "briefcase",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-servicos",
    userId: null,
    name: "Serviços",
    color: "#00C7C4",
    icon: "wrench",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-rendimentos",
    userId: null,
    name: "Rendimentos",
    color: "#015363",
    icon: "trending-up",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-poupanca",
    userId: null,
    name: "Poupança",
    color: "#00C7C4",
    icon: "piggy-bank",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-investimentos",
    userId: null,
    name: "Investimentos",
    color: "#012048",
    icon: "trending-up",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-reembolsos",
    userId: null,
    name: "Reembolsos",
    color: "#015363",
    icon: "rotate-ccw",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-alimentacao",
    userId: null,
    name: "Alimentação",
    color: "#015363",
    icon: "utensils",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-moradia",
    userId: null,
    name: "Moradia",
    color: "#012048",
    icon: "home",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-transporte",
    userId: null,
    name: "Transporte",
    color: "#B45309",
    icon: "car",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-saude",
    userId: null,
    name: "Saúde",
    color: "#0F766E",
    icon: "heart-pulse",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-lazer",
    userId: null,
    name: "Lazer",
    color: "#C2410C",
    icon: "gamepad-2",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-assinaturas",
    userId: null,
    name: "Assinaturas",
    color: "#5B21B6",
    icon: "repeat",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-educacao",
    userId: null,
    name: "Educação",
    color: "#0F766E",
    icon: "graduation-cap",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-tarifas",
    userId: null,
    name: "Tarifas",
    color: "#64748B",
    icon: "receipt",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-transferencias",
    userId: null,
    name: "Transferências",
    color: "#881337",
    icon: "arrow-left-right",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-default-outros",
    userId: null,
    name: "Outros",
    color: "#64748B",
    icon: "layers",
    isDefault: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-custom-academia",
    userId: "user-mock",
    name: "Academia & Bem-estar",
    color: "#0F766E",
    icon: "heart-pulse",
    isDefault: false,
    status: "ACTIVE",
    createdAt: "2026-10-05T14:20:00.000Z",
    updatedAt: "2026-10-05T14:20:00.000Z",
  },
  {
    id: "cat-custom-viagens",
    userId: "user-mock",
    name: "Viagens",
    color: "#5B21B6",
    icon: "shopping-bag",
    isDefault: false,
    status: "ACTIVE",
    createdAt: "2026-10-18T11:00:00.000Z",
    updatedAt: "2026-10-18T11:00:00.000Z",
  },
  {
    id: "cat-custom-antiga",
    userId: "user-mock",
    name: "Cursos Antigos",
    color: "#1E293B",
    icon: "graduation-cap",
    isDefault: false,
    status: "INACTIVE",
    createdAt: "2026-08-12T09:30:00.000Z",
    updatedAt: "2026-09-29T16:10:00.000Z",
  },
];

let storeState: { categories: CategoryItem[] } = {
  categories: INITIAL_CATEGORIES,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return storeState;
}

const serverSnapshot = {
  categories: INITIAL_CATEGORIES,
};

function getServerSnapshot() {
  return serverSnapshot;
}

export function createMockCategory(input: CreateCategoryInput): {
  ok: true;
  category: CategoryItem;
} | {
  ok: false;
  error: string;
} {
  const normalizedName = input.name.trim();
  const duplicate = storeState.categories.find(
    (item) =>
      item.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicate) {
    return {
      ok: false,
      error: "Já existe uma categoria cadastrada com esse nome.",
    };
  }

  const now = new Date().toISOString();
  const newCategory: CategoryItem = {
    id: `cat-${Date.now().toString(36)}`,
    userId: "user-mock",
    name: normalizedName,
    color: input.color || DEFAULT_ACCOUNT_COLOR,
    icon: input.icon || "tag",
    isDefault: false,
    status: input.status ?? "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  storeState = {
    categories: [newCategory, ...storeState.categories],
  };

  emitChange();
  return { ok: true, category: newCategory };
}

export function updateMockCategory(
  categoryId: string,
  input: UpdateCategoryInput,
): {
  ok: true;
  category: CategoryItem;
} | {
  ok: false;
  error: string;
} {
  const target = storeState.categories.find((item) => item.id === categoryId);
  if (!target) {
    return { ok: false, error: "Categoria não encontrada." };
  }
  if (target.isDefault) {
    return {
      ok: false,
      error: "Categorias padrão do sistema não podem ser editadas.",
    };
  }

  const normalizedName = input.name.trim();
  const duplicate = storeState.categories.find(
    (item) =>
      item.id !== categoryId &&
      item.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicate) {
    return {
      ok: false,
      error: "Já existe outra categoria cadastrada com esse nome.",
    };
  }

  const now = new Date().toISOString();
  let updated: CategoryItem | null = null;

  storeState = {
    categories: storeState.categories.map((item) => {
      if (item.id !== categoryId) return item;
      updated = {
        ...item,
        name: normalizedName,
        color: input.color || DEFAULT_ACCOUNT_COLOR,
        icon: input.icon || "tag",
        status: input.status,
        updatedAt: now,
      };
      return updated;
    }),
  };

  if (!updated) {
    return { ok: false, error: "Categoria não encontrada." };
  }

  emitChange();
  return { ok: true, category: updated };
}

export function toggleMockCategoryStatus(categoryId: string): {
  ok: true;
  category: CategoryItem;
} | {
  ok: false;
  error: string;
} {
  const target = storeState.categories.find((item) => item.id === categoryId);
  if (!target) {
    return { ok: false, error: "Categoria não encontrada." };
  }
  if (target.isDefault) {
    return {
      ok: false,
      error: "Categorias padrão do sistema não podem ser inativadas.",
    };
  }

  const now = new Date().toISOString();
  const nextStatus: CategoryStatus =
    target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const updated: CategoryItem = {
    ...target,
    status: nextStatus,
    updatedAt: now,
  };

  storeState = {
    categories: storeState.categories.map((item) =>
      item.id === categoryId ? updated : item,
    ),
  };

  emitChange();
  return { ok: true, category: updated };
}

export function deleteMockCategory(categoryId: string): {
  ok: true;
  deleted: CategoryItem;
} | {
  ok: false;
  error: string;
} {
  const target = storeState.categories.find((item) => item.id === categoryId);
  if (!target) {
    return { ok: false, error: "Categoria não encontrada." };
  }
  if (target.isDefault) {
    return {
      ok: false,
      error: "Categorias padrão do sistema não podem ser excluídas.",
    };
  }

  storeState = {
    categories: storeState.categories.filter((item) => item.id !== categoryId),
  };

  emitChange();
  return { ok: true, deleted: target };
}

export function useCategoriesStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
