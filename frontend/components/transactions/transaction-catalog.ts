import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import type {
  TransactionKind,
  TransactionStatus,
} from "@/components/accounts/accounts-mock-store";

export interface TransactionCategoryMeta {
  name: string;
  color: string;
  kind: TransactionKind;
}

export const TRANSACTION_CATEGORIES: readonly TransactionCategoryMeta[] = [
  { name: "Salário", color: "#00C7C4", kind: "INCOME" },
  { name: "Serviços", color: "#00C7C4", kind: "INCOME" },
  { name: "Rendimentos", color: "#015363", kind: "INCOME" },
  { name: "Poupança", color: "#00C7C4", kind: "INCOME" },
  { name: "Investimentos", color: "#012048", kind: "INCOME" },
  { name: "Reembolsos", color: "#015363", kind: "INCOME" },
  { name: "Outros", color: "#64748B", kind: "INCOME" },
  { name: "Alimentação", color: "#015363", kind: "EXPENSE" },
  { name: "Moradia", color: "#012048", kind: "EXPENSE" },
  { name: "Transporte", color: "#B45309", kind: "EXPENSE" },
  { name: "Saúde", color: "#0F766E", kind: "EXPENSE" },
  { name: "Lazer", color: "#C2410C", kind: "EXPENSE" },
  { name: "Assinaturas", color: "#5B21B6", kind: "EXPENSE" },
  { name: "Educação", color: "#0F766E", kind: "EXPENSE" },
  { name: "Tarifas", color: "#64748B", kind: "EXPENSE" },
  { name: "Transferências", color: "#881337", kind: "EXPENSE" },
  { name: "Outros", color: "#64748B", kind: "EXPENSE" },
] as const;

export const TRANSACTION_STATUS_META: Record<
  TransactionStatus,
  { label: string; badgeVariant: "success" | "warning" }
> = {
  CONFIRMED: {
    label: "Confirmada",
    badgeVariant: "success",
  },
  PENDING: {
    label: "Pendente",
    badgeVariant: "warning",
  },
};

/**
 * Formata uma data ISO (yyyy-MM-dd) para exibição padrão brasileira.
 */
export function formatTransactionDate(dateString: string): string {
  const parsed = parseISO(dateString);
  if (!isValid(parsed)) return dateString;
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Retorna as categorias disponíveis para o tipo de transação selecionado.
 */
export function getCategoriesByKind(
  kind: TransactionKind,
): TransactionCategoryMeta[] {
  return TRANSACTION_CATEGORIES.filter((item) => item.kind === kind);
}

/**
 * Busca a cor padrão da categoria quando cadastrada no catálogo.
 */
export function resolveCategoryColor(
  categoryName: string,
  kind: TransactionKind,
): string {
  const match = TRANSACTION_CATEGORIES.find(
    (item) =>
      item.kind === kind &&
      item.name.toLowerCase() === categoryName.trim().toLowerCase(),
  );
  return match?.color ?? "#64748B";
}
