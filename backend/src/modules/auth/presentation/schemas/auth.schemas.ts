import z from "zod";

export const loginSchema = z.object({
  identifier: z.string({ error: "Identificador deve ser um texto." }).trim().min(1, "Identificador é obrigatório."),
  password: z.string({ error: "Senha deve ser um texto." }).min(1, "Senha é obrigatória."),
}).strict();

const requestMetadataSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90, "Latitude inválida.").max(90, "Latitude inválida."),
    longitude: z.number().min(-180, "Longitude inválida.").max(180, "Longitude inválida."),
  }).strict().nullable().optional(),
  deviceId: z.string().trim().min(1, "Identificador do dispositivo inválido.").max(255, "Identificador do dispositivo inválido.").nullable().optional(),
}).strict().optional();

export const requestPasswordResetSchema = z.object({
  email: z.string({ error: "E-mail deve ser um texto." }).trim().email("E-mail inválido.").toLowerCase(),
  metadata: requestMetadataSchema,
}).strict();

export const confirmPasswordResetSchema = z.object({
  token: z.string({ error: "Token deve ser um texto." }).trim().min(1, "Token é obrigatório."),
  password: z.string({ error: "Senha deve ser um texto." }).min(8, "Senha deve possuir pelo menos 8 caracteres."),
  passwordConfirmation: z.string({ error: "Confirmação deve ser um texto." }).min(1, "Confirmação de senha é obrigatória."),
  metadata: requestMetadataSchema,
}).strict().refine((input) => input.password === input.passwordConfirmation, {
  message: "A senha e a confirmação devem corresponder.",
  path: ["passwordConfirmation"],
});

export const requestAccountReactivationSchema = z.object({
  email: z.string({ error: "E-mail deve ser um texto." }).trim().email("E-mail inválido.").toLowerCase(),
  metadata: requestMetadataSchema,
}).strict();

export const confirmAccountReactivationSchema = z.object({
  token: z.string({ error: "Token deve ser um texto." }).trim().min(1, "Token é obrigatório."),
  metadata: requestMetadataSchema,
}).strict();

export type LoginRequestDto = z.infer<typeof loginSchema>;
