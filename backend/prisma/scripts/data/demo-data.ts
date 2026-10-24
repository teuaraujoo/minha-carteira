import { createHash } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { User } from "../../../src/modules/users/domain/entities/users.entity.js";
import { UserCapabilities, UserRoles, UserStatus } from "../../../src/modules/users/domain/enums/users.enums.js";
import type { PasswordHasher } from "../../../src/shared/application/security/password-hasher.js";
import { createUserSchema } from "../../../src/modules/users/presentation/schemas/users.schemas.js";

export const DEMO_USERS = [
  { id: "71000000-0000-4000-8000-000000000001", username: "teste admin", name: "Administrador de Demonstração", email: "teste.admin@example.com", role: UserRoles.ADMIN, capabilities: [], status: UserStatus.ACTIVE },
  { id: "71000000-0000-4000-8000-000000000002", username: "teste user", name: "Usuário de Demonstração", email: "teste.user@example.com", role: UserRoles.USER, capabilities: [], status: UserStatus.ACTIVE },
  { id: "71000000-0000-4000-8000-000000000003", username: "teste telegram", name: "Usuário com Capacidade Telegram", email: "teste.telegram@example.com", role: UserRoles.USER, capabilities: [UserCapabilities.TELEGRAM_MESSAGES], status: UserStatus.ACTIVE },
  { id: "71000000-0000-4000-8000-000000000004", username: "teste inactive", name: "Usuário Inativo de Demonstração", email: "teste.inactive@example.com", role: UserRoles.USER, capabilities: [], status: UserStatus.INACTIVE },
];

export const DEMO_AVATAR = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwyNvyHwAE1gJq0pE2mwAAAABJRU5ErkJggg==",
  "base64",
);

export async function createDemoUsers(
  passwords: { admin: string; user: string },
  passwordHasher: PasswordHasher,
  now: Date,
): Promise<Array<Prisma.UserUncheckedCreateInput & { id: string }>> {
  // A validação ocorre antes do bcrypt e de qualquer escrita no banco.
  const validated = DEMO_USERS.map((user, index) => ({
    definition: user,
    input: createUserSchema.parse({
      username: user.username, name: user.name, email: user.email,
      phone: `+551199999000${index}`, password: user.role === UserRoles.ADMIN ? passwords.admin : passwords.user,
    }),
  }));
  const adminHash = await passwordHasher.hash(passwords.admin);
  const userHash = await passwordHasher.hash(passwords.user);
  return validated.map(({ definition, input }) => {
    const user = new User({
      ...definition, ...input, phone: input.phone,
      passwordHash: definition.role === UserRoles.ADMIN ? adminHash : userHash,
      createdAt: now, updatedAt: now,
      inactivatedAt: definition.status === UserStatus.INACTIVE ? now : null,
    });
    return { ...user.toJSON(), passwordHash: user.passwordHash };
  });
}

export function createDemoHistory(now: Date) {
  const issuedAt = new Date(now.getTime() - 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() - 30 * 60 * 1000);
  const completedAt = new Date(now.getTime() - 45 * 60 * 1000);
  const metadata = { location: null, userAgent: "Seed de demonstração", ipAddress: null, deviceId: null };
  const userId = DEMO_USERS[1]!.id;
  const requestId = "72000000-0000-4000-8000-000000000001";
  const secretHash = (label: string) => createHash("sha256").update(label).digest("hex");
  const request: Prisma.PasswordResetRequestUncheckedCreateInput = {
    id: requestId, userId, status: "COMPLETED", requestedAt: issuedAt, expiresAt,
    metadata, completedAt, cancelledAt: null, createdAt: issuedAt, updatedAt: completedAt,
  };
  const challenges: Prisma.ChallengeUncheckedCreateInput[] = [
    { id: "73000000-0000-4000-8000-000000000001", purpose: "PASSWORD_RESET", subjectType: "PASSWORD_RESET_REQUEST", subjectId: requestId, secretHash: secretHash("seed-reset-concluido"), status: "COMPLETED", attempts: 0, maxAttempts: 3, metadata: { issued: metadata, consumed: metadata }, expiresAt, consumedAt: completedAt, createdAt: issuedAt, updatedAt: completedAt },
    { id: "73000000-0000-4000-8000-000000000002", purpose: "ACCOUNT_REACTIVATION", subjectType: "USER", subjectId: DEMO_USERS[3]!.id, secretHash: secretHash("seed-reativacao-expirada"), status: "EXPIRED", attempts: 0, maxAttempts: 3, metadata: { issued: metadata, consumed: null }, expiresAt, consumedAt: null, createdAt: issuedAt, updatedAt: now },
  ];
  const refreshToken: Prisma.RefreshTokenUncheckedCreateInput = {
    id: "74000000-0000-4000-8000-000000000001", userId,
    tokenHash: secretHash("seed-sessao-revogada"), issuedAt, expiresAt, lastUsedAt: null,
    revokedAt: completedAt, revokeReason: "LOGOUT", userAgent: metadata.userAgent, ipAddress: null,
    createdAt: issuedAt, updatedAt: completedAt,
  };
  return { request, challenges, refreshToken };
}
