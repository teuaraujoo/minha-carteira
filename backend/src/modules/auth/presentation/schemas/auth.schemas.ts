import z from "zod";

export const loginSchema = z.object({
  identifier: z.string({ error: "Identificador deve ser um texto." }).trim().min(1, "Identificador é obrigatório."),
  password: z.string({ error: "Senha deve ser um texto." }).min(1, "Senha é obrigatória."),
}).strict();

export type LoginRequestDto = z.infer<typeof loginSchema>;
