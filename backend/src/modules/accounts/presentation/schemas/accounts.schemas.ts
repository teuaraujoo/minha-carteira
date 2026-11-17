import z from "zod";
import { AccountStatus, AccountType } from "../../domain/enums/account.enums.js";

const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;
const MAX_BALANCE_AMOUNT = 999_999_999_999.99;

function hasAtMostTwoDecimals(value: number): boolean {
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(value - rounded) <= 1e-9;
}

const accountNameSchema = z
  .string({ error: "O nome da conta deve ser um texto." })
  .trim()
  .min(2, "O nome da conta deve possuir pelo menos 2 caracteres.")
  .max(80, "O nome da conta deve possuir no máximo 80 caracteres.");

function optionalTrimmedTextSchema(field: string, maxLength: number) {
  return z
    .string({ error: `${field} deve ser um texto.` })
    .trim()
    .max(maxLength, `${field} deve possuir no máximo ${maxLength} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();
}

const optionalHexColorSchema = z
  .string({ error: "A cor deve ser um texto." })
  .trim()
  .transform((value) => (value === "" ? null : value.toUpperCase()))
  .refine((value) => value === null || HEX_COLOR_REGEX.test(value), "A cor deve estar no formato hexadecimal #RRGGBB.")
  .nullable()
  .optional();

export const accountIdParamSchema = z
  .object({
    accountId: z.string({ error: "O ID da conta deve ser um texto." }).trim().uuid("ID da conta inválido."),
  })
  .strict();

export const listAccountsQuerySchema = z
  .object({
    status: z.enum(AccountStatus, { error: "Status da conta inválido." }).optional(),
    type: z.enum(AccountType, { error: "Tipo de conta inválido." }).optional(),
    search: z
      .string({ error: "O termo de busca deve ser um texto." })
      .trim()
      .max(80, "O termo de busca deve possuir no máximo 80 caracteres.")
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  })
  .strict();

export const createAccountSchema = z
  .object({
    name: accountNameSchema,
    type: z.enum(AccountType, { error: "Tipo de conta inválido." }),
    initialBalance: z
      .number({ error: "O saldo inicial deve ser um número." })
      .finite("O saldo inicial deve ser um número válido.")
      .min(0, "O saldo inicial não pode ser negativo.")
      .max(MAX_BALANCE_AMOUNT, "O saldo inicial excede o limite suportado.")
      .refine(hasAtMostTwoDecimals, "O saldo inicial deve possuir no máximo 2 casas decimais."),
    brand: optionalTrimmedTextSchema("Bandeira", 60),
    institution: optionalTrimmedTextSchema("Instituição", 80),
    color: optionalHexColorSchema,
  })
  .strict();

export const updateAccountSchema = z
  .object({
    name: accountNameSchema.optional(),
    type: z.enum(AccountType, { error: "Tipo de conta inválido." }).optional(),
    brand: optionalTrimmedTextSchema("Bandeira", 60),
    institution: optionalTrimmedTextSchema("Instituição", 80),
    color: optionalHexColorSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.name !== undefined
      || input.type !== undefined
      || input.brand !== undefined
      || input.institution !== undefined
      || input.color !== undefined,
    "Informe ao menos um campo para atualizar.",
  );

const MONTH_MM_YYYY_REGEX = /^(0[1-9]|1[0-2])\/(19\d{2}|20\d{2}|2100)$/;
const MONTH_YYYY_MM_REGEX = /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/;

function parseMonthCompetence(rawValue: string): { year: number; month: number } | null {
  const mmYyyyMatch = MONTH_MM_YYYY_REGEX.exec(rawValue);
  if (mmYyyyMatch) {
    return {
      month: Number(mmYyyyMatch[1]),
      year: Number(mmYyyyMatch[2]),
    };
  }

  const yyyyMmMatch = MONTH_YYYY_MM_REGEX.exec(rawValue);
  if (yyyyMmMatch) {
    return {
      year: Number(yyyyMmMatch[1]),
      month: Number(yyyyMmMatch[2]),
    };
  }

  return null;
}

export const getAccountDetailQuerySchema = z
  .object({
    month: z
      .string({ error: "A competência deve ser um texto no formato MM/YYYY ou YYYY-MM." })
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .optional()
      .transform((value, ctx) => {
        if (value === undefined) return undefined;
        const parsed = parseMonthCompetence(value);
        if (!parsed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A competência deve estar no formato MM/YYYY ou YYYY-MM (ex.: 11/2026).",
          });
          return z.NEVER;
        }
        return parsed;
      }),
  })
  .strict();

export type CreateAccountRequestDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountRequestDto = z.infer<typeof updateAccountSchema>;
export type ListAccountsQueryDto = z.infer<typeof listAccountsQuerySchema>;
export type GetAccountDetailQueryDto = z.infer<typeof getAccountDetailQuerySchema>;
