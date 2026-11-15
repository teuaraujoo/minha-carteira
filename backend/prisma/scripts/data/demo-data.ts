import { createHash } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { Account } from "../../../src/modules/accounts/domain/entities/account.entity.js";
import { AccountType } from "../../../src/modules/accounts/domain/enums/account.enums.js";
import { Category } from "../../../src/modules/categories/domain/entities/category.entity.js";
import { CategoryStatus } from "../../../src/modules/categories/domain/enums/category.enums.js";
import { Transaction } from "../../../src/modules/transactions/domain/entities/transaction.entity.js";
import {
  TransactionStatus,
  TransactionType,
} from "../../../src/modules/transactions/domain/enums/transaction.enums.js";
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
  const secretHash = (label: string) => createHash("sha256").update(label).digest("hex");
  const challenges: Prisma.ChallengeUncheckedCreateInput[] = [
    { id: "73000000-0000-4000-8000-000000000001", purpose: "PASSWORD_RESET", subjectType: "USER", subjectId: userId, targetEmail: null, secretHash: secretHash("seed-reset-concluido"), status: "COMPLETED", attempts: 0, maxAttempts: 3, nextAttemptAt: null, metadata: { issued: metadata, consumed: metadata }, expiresAt, consumedAt: completedAt, createdAt: issuedAt, updatedAt: completedAt },
    { id: "73000000-0000-4000-8000-000000000002", purpose: "ACCOUNT_REACTIVATION", subjectType: "USER", subjectId: DEMO_USERS[3]!.id, targetEmail: null, secretHash: secretHash("seed-reativacao-expirada"), status: "EXPIRED", attempts: 0, maxAttempts: 3, nextAttemptAt: null, metadata: { issued: metadata, consumed: null }, expiresAt, consumedAt: null, createdAt: issuedAt, updatedAt: now },
    { id: "73000000-0000-4000-8000-000000000003", purpose: "EMAIL_VERIFICATION", subjectType: "EMAIL", subjectId: null, targetEmail: "seed.mfa@example.com", secretHash: secretHash("seed-mfa-expirado"), status: "EXPIRED", attempts: 0, maxAttempts: 3, nextAttemptAt: new Date(issuedAt.getTime() + 45 * 1000), metadata: { issued: metadata, consumed: null }, expiresAt, consumedAt: null, createdAt: issuedAt, updatedAt: now },
  ];
  const refreshToken: Prisma.RefreshTokenUncheckedCreateInput = {
    id: "74000000-0000-4000-8000-000000000001", userId,
    tokenHash: secretHash("seed-sessao-revogada"), issuedAt, expiresAt, lastUsedAt: null,
    revokedAt: completedAt, revokeReason: "LOGOUT", userAgent: metadata.userAgent, ipAddress: null,
    createdAt: issuedAt, updatedAt: completedAt,
  };
  return { challenges, refreshToken };
}

export function createDemoAccounts(now: Date): Array<Prisma.AccountUncheckedCreateInput & { id: string }> {
  const ownerUserId = DEMO_USERS[1]!.id;
  const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const inactivatedAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const digital = Account.create({
    id: "76000000-0000-4000-8000-000000000001",
    userId: ownerUserId,
    name: "Nubank Principal",
    type: AccountType.DIGITAL,
    brand: "mastercard",
    institution: "Nubank",
    color: "#8A05BE",
    initialBalance: 3500,
    now: createdAt,
  });

  const checking = Account.create({
    id: "76000000-0000-4000-8000-000000000002",
    userId: ownerUserId,
    name: "Banco do Brasil",
    type: AccountType.CHECKING,
    brand: "visa",
    institution: "Banco do Brasil",
    color: "#0038A8",
    initialBalance: 1200.5,
    now: createdAt,
  });

  const inactive = Account.create({
    id: "76000000-0000-4000-8000-000000000003",
    userId: ownerUserId,
    name: "Cartão Antigo",
    type: AccountType.DIGITAL,
    brand: "elo",
    institution: "Banco Inter",
    color: "#64748B",
    initialBalance: 0,
    now: createdAt,
  });
  inactive.deactivate(inactivatedAt);

  return [digital.toJSON(), checking.toJSON(), inactive.toJSON()];
}

export const DEFAULT_CATEGORY_DEFINITIONS = [
  { id: "77000000-0000-4000-8000-000000000001", name: "Salário", color: "#00C7C4", icon: "briefcase" },
  { id: "77000000-0000-4000-8000-000000000002", name: "Serviços", color: "#00C7C4", icon: "wrench" },
  { id: "77000000-0000-4000-8000-000000000003", name: "Rendimentos", color: "#015363", icon: "trending-up" },
  { id: "77000000-0000-4000-8000-000000000004", name: "Poupança", color: "#00C7C4", icon: "piggy-bank" },
  { id: "77000000-0000-4000-8000-000000000005", name: "Investimentos", color: "#012048", icon: "trending-up" },
  { id: "77000000-0000-4000-8000-000000000006", name: "Reembolsos", color: "#015363", icon: "rotate-ccw" },
  { id: "77000000-0000-4000-8000-000000000007", name: "Alimentação", color: "#015363", icon: "utensils" },
  { id: "77000000-0000-4000-8000-000000000008", name: "Moradia", color: "#012048", icon: "home" },
  { id: "77000000-0000-4000-8000-000000000009", name: "Transporte", color: "#B45309", icon: "car" },
  { id: "77000000-0000-4000-8000-000000000010", name: "Saúde", color: "#0F766E", icon: "heart-pulse" },
  { id: "77000000-0000-4000-8000-000000000011", name: "Lazer", color: "#C2410C", icon: "gamepad-2" },
  { id: "77000000-0000-4000-8000-000000000012", name: "Assinaturas", color: "#5B21B6", icon: "repeat" },
  { id: "77000000-0000-4000-8000-000000000013", name: "Educação", color: "#0F766E", icon: "graduation-cap" },
  { id: "77000000-0000-4000-8000-000000000014", name: "Tarifas", color: "#64748B", icon: "receipt" },
  { id: "77000000-0000-4000-8000-000000000015", name: "Transferências", color: "#881337", icon: "arrow-left-right" },
  { id: "77000000-0000-4000-8000-000000000016", name: "Outros", color: "#64748B", icon: "layers" },
] as const;

export function createDefaultCategories(
  now: Date,
): Array<Prisma.CategoryUncheckedCreateInput & { id: string }> {
  const createdAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  return DEFAULT_CATEGORY_DEFINITIONS.map((definition) => {
    const category = new Category({
      id: definition.id,
      userId: null,
      name: definition.name,
      color: definition.color,
      icon: definition.icon,
      isDefault: true,
      status: CategoryStatus.ACTIVE,
      createdAt,
      updatedAt: createdAt,
    });
    return category.toJSON();
  });
}

export function createDemoTransactions(
  now: Date,
): Array<Prisma.TransactionUncheckedCreateInput & { id: string }> {
  const ownerUserId = DEMO_USERS[1]!.id;
  const createdAt = new Date(now.getTime() - 60 * 60 * 1000);
  const transactionDate = now.toISOString().slice(0, 10);

  const salaryIncome = Transaction.create({
    id: "78000000-0000-4000-8000-000000000001",
    userId: ownerUserId,
    accountId: "76000000-0000-4000-8000-000000000002",
    categoryId: DEFAULT_CATEGORY_DEFINITIONS[0].id,
    description: "Salário mensal",
    amount: 4500,
    type: TransactionType.INCOME,
    status: TransactionStatus.CONFIRMED,
    transactionDate,
    notes: "Crédito em folha de pagamento.",
    now: createdAt,
  });

  const groceryExpense = Transaction.create({
    id: "78000000-0000-4000-8000-000000000002",
    userId: ownerUserId,
    accountId: "76000000-0000-4000-8000-000000000001",
    categoryId: DEFAULT_CATEGORY_DEFINITIONS[6].id,
    description: "Supermercado da semana",
    amount: 180.5,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CONFIRMED,
    transactionDate,
    notes: null,
    now: createdAt,
  });

  const pendingSubscription = Transaction.create({
    id: "78000000-0000-4000-8000-000000000003",
    userId: ownerUserId,
    accountId: "76000000-0000-4000-8000-000000000001",
    categoryId: DEFAULT_CATEGORY_DEFINITIONS[11].id,
    description: "Assinatura de nuvem",
    amount: 59.9,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    transactionDate,
    notes: "Débito previsto para o fechamento da fatura.",
    now: createdAt,
  });

  return [salaryIncome, groceryExpense, pendingSubscription].map((transaction) => ({
    ...transaction.toJSON(),
    amount: transaction.amount.toFixed(2),
    transactionDate: new Date(`${transaction.transactionDate}T00:00:00.000Z`),
  }));
}
