import z from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_PROFILE_IMAGE_SIZE } from "../../../storage/application/constants/image.constants.js";

export const createUserSchema = z
  .object({
    username: z
      .string({ error: "Nome de usuário deve ser uma string." })
      .trim()
      .min(5, "Nome de usuário é obrigatório."),
    name: z
      .string({ error: "Nome deve ser uma string." })
      .trim()
      .min(5, "Nome é obrigatório."),
    email: z
      .string({ error: "E-mail deve ser uma string." })
      .trim()
      .min(5, "E-mail é obrigatório.")
      .email("E-mail inválido.")
      .toLowerCase(),
    phone: z
      .string({ error: "Telefone deve ser uma string." })
      .trim()
      .min(11, "Telefone é obrigatório."),
    password: z
      .string({ error: "Senha deve ser uma string." })
      .trim()
      .min(8, "Senha é obrigatória.")
  })
  .strict();


export const uploadProfileImageSchema = z.object({
  image: z.object({
    content: z.instanceof(Buffer),
    contentType: z.string().refine((value) => ALLOWED_IMAGE_TYPES.has(value), "Tipo de imagem não permitido."),
    size: z.number().int().positive().max(MAX_PROFILE_IMAGE_SIZE, "Imagem excede o limite de 10 MiB."),
  }).strict().refine((image) => image.content.length === image.size, "Tamanho da imagem inválido."),
}).strict();

export type CreateUserRequestDto = z.infer<typeof createUserSchema>;
export type UploadProfileImageRequestDto = z.infer<typeof uploadProfileImageSchema>;
