import { z } from "zod";
import { CategoryStatus } from "../../domain/enums/category.enums.js";

const categoryNameSchema = z
  .string({ error: "O nome da categoria é obrigatório." })
  .trim()
  .min(2, "O nome da categoria deve possuir pelo menos 2 caracteres.")
  .max(60, "O nome da categoria deve possuir no máximo 60 caracteres.");

const categoryColorSchema = z
  .string({ error: "A cor da categoria deve ser um texto." })
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "A cor da categoria deve estar no formato hexadecimal #RRGGBB.");

const categoryIconSchema = z
  .string({ error: "O ícone da categoria deve ser um texto." })
  .trim()
  .max(40, "O ícone da categoria deve possuir no máximo 40 caracteres.");

const optionalNullableColorSchema = z
  .union([categoryColorSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return value.toUpperCase();
  });

const optionalNullableIconSchema = z
  .union([categoryIconSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return value;
  });

export const categoryIdParamSchema = z.object({
  categoryId: z.string().trim().uuid("ID da categoria inválido."),
});

export const createCategorySchema = z
  .object({
    name: categoryNameSchema,
    color: optionalNullableColorSchema,
    icon: optionalNullableIconSchema,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    color: optionalNullableColorSchema,
    icon: optionalNullableIconSchema,
  })
  .strict()
  .refine(
    (data) => data.name !== undefined || data.color !== undefined || data.icon !== undefined,
    { message: "Informe ao menos um campo para atualizar a categoria." },
  );

export const listCategoriesQuerySchema = z
  .object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    status: z.enum([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE] as const, {
      error: "Status da categoria inválido.",
    }).optional(),
    search: z
      .string({ error: "O termo de busca deve ser um texto." })
      .trim()
      .max(60, "O termo de busca deve possuir no máximo 60 caracteres.")
      .optional(),
  })
  .strict();
