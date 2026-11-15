import { z } from "zod";
import {
  MAX_TRANSACTION_AMOUNT,
  validateTransactionDate,
} from "../../domain/entities/transaction.entity.js";
import {
  SortOrder,
  TransactionSortBy,
  TransactionStatus,
  TransactionType,
} from "../../domain/enums/transaction.enums.js";

const civilDateSchema = z
  .string({ error: "A data deve ser um texto no formato YYYY-MM-DD." })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A data deve estar no formato YYYY-MM-DD.")
  .refine(
    (value) => {
      try {
        validateTransactionDate(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "A data informada não existe no calendário." },
  );

const optionalCategoryIdSchema = z
  .union([z.string().uuid("ID da categoria inválido."), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return value;
  });

const optionalNotesSchema = z
  .union([
    z.string({ error: "As observações devem ser um texto." })
      .trim()
      .max(500, "As observações devem possuir no máximo 500 caracteres."),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return value;
  });

export const transactionIdParamSchema = z.object({
  transactionId: z.string().trim().uuid("ID da transação inválido."),
});

export const createTransactionSchema = z
  .object({
    accountId: z.string().trim().uuid("ID da conta inválido."),
    categoryId: optionalCategoryIdSchema,
    description: z
      .string({ error: "A descrição da transação é obrigatória." })
      .trim()
      .min(2, "A descrição da transação deve possuir pelo menos 2 caracteres.")
      .max(120, "A descrição da transação deve possuir no máximo 120 caracteres."),
    amount: z
      .number({ error: "O valor da transação deve ser numérico." })
      .finite("O valor da transação deve ser um número válido.")
      .positive("O valor da transação deve ser maior que zero.")
      .max(MAX_TRANSACTION_AMOUNT, "O valor da transação excede o limite máximo permitido.")
      .refine(
        (value) => Math.abs(Math.round(value * 100) - value * 100) <= 1e-8,
        "O valor da transação deve possuir no máximo 2 casas decimais.",
      ),
    type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE] as const, {
      error: "Tipo da transação inválido.",
    }),
    status: z
      .enum([TransactionStatus.CONFIRMED, TransactionStatus.PENDING] as const, {
        error: "Status da transação inválido.",
      })
      .optional(),
    transactionDate: civilDateSchema,
    notes: optionalNotesSchema,
  })
  .strict();

export const listTransactionsQuerySchema = z
  .object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    status: z
      .enum([TransactionStatus.CONFIRMED, TransactionStatus.PENDING] as const, {
        error: "Status da transação inválido.",
      })
      .optional(),
    type: z
      .enum([TransactionType.INCOME, TransactionType.EXPENSE] as const, {
        error: "Tipo da transação inválido.",
      })
      .optional(),
    accountId: z.string().trim().uuid("ID da conta inválido.").optional(),
    categoryId: z.string().trim().uuid("ID da categoria inválido.").optional(),
    dateFrom: civilDateSchema.optional(),
    dateTo: civilDateSchema.optional(),
    search: z
      .string({ error: "O termo de busca deve ser um texto." })
      .trim()
      .max(120, "O termo de busca deve possuir no máximo 120 caracteres.")
      .optional(),
    sortBy: z
      .enum([TransactionSortBy.TRANSACTION_DATE, TransactionSortBy.AMOUNT] as const, {
        error: "Campo de ordenação inválido.",
      })
      .optional(),
    sortOrder: z
      .enum([SortOrder.ASC, SortOrder.DESC] as const, {
        error: "Ordem de classificação inválida.",
      })
      .optional(),
  })
  .strict();
