import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { TransactionStatus } from "@/services/transactions.service";

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
