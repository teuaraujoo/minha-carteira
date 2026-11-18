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
  const fallbackCreatedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const nubank = Account.create({
    id: "76000000-0000-4000-8000-000000000001",
    userId: ownerUserId,
    name: "Nubank Principal",
    type: AccountType.DIGITAL,
    brand: "mastercard",
    institution: "Nubank",
    color: "#5B21B6",
    initialBalance: 1200,
    now: new Date("2026-01-12T10:00:00.000Z"),
  });

  const itau = Account.create({
    id: "76000000-0000-4000-8000-000000000002",
    userId: ownerUserId,
    name: "Itaú Uniclass",
    type: AccountType.CHECKING,
    brand: "hipercard",
    institution: "Itaú",
    color: "#C2410C",
    initialBalance: 3500,
    now: new Date("2025-11-04T09:15:00.000Z"),
  });

  const inactive = Account.create({
    id: "76000000-0000-4000-8000-000000000003",
    userId: ownerUserId,
    name: "Conta Antiga Universitária",
    type: AccountType.CHECKING,
    brand: "elo",
    institution: "Santander",
    color: "#881337",
    initialBalance: 500,
    now: new Date("2024-03-10T09:00:00.000Z"),
  });
  inactive.deactivate(new Date("2026-09-14T10:30:00.000Z"));

  const reserva = Account.create({
    id: "76000000-0000-4000-8000-000000000004",
    userId: ownerUserId,
    name: "Reserva Turquesa",
    type: AccountType.SAVINGS,
    brand: "mastercard",
    institution: "Inter",
    color: "#015363",
    initialBalance: 15000,
    now: new Date("2025-08-20T14:00:00.000Z"),
  });

  const caixa = Account.create({
    id: "76000000-0000-4000-8000-000000000005",
    userId: ownerUserId,
    name: "Caixa Econômica",
    type: AccountType.CHECKING,
    brand: "elo",
    institution: "Caixa",
    color: "#0F766E",
    initialBalance: 420,
    now: new Date("2026-11-01T08:30:00.000Z") ?? fallbackCreatedAt,
  });

  const xp = Account.create({
    id: "76000000-0000-4000-8000-000000000006",
    userId: ownerUserId,
    name: "XP Renda Fixa",
    type: AccountType.INVESTMENT,
    brand: "visa",
    institution: "XP Investimentos",
    color: "#012048",
    initialBalance: 25000,
    now: new Date("2025-06-15T12:00:00.000Z"),
  });

  return [
    nubank.toJSON(),
    itau.toJSON(),
    reserva.toJSON(),
    caixa.toJSON(),
    xp.toJSON(),
    inactive.toJSON(),
  ];
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

export function createCustomCategories(
  _now: Date,
): Array<Prisma.CategoryUncheckedCreateInput & { id: string }> {
  const ownerUserId = DEMO_USERS[1]!.id;

  const academia = new Category({
    id: "77000000-0000-4000-8000-000000000101",
    userId: ownerUserId,
    name: "Academia & Bem-estar",
    color: "#0F766E",
    icon: "heart-pulse",
    isDefault: false,
    status: CategoryStatus.ACTIVE,
    createdAt: new Date("2026-10-05T14:20:00.000Z"),
    updatedAt: new Date("2026-10-05T14:20:00.000Z"),
  });

  const viagens = new Category({
    id: "77000000-0000-4000-8000-000000000102",
    userId: ownerUserId,
    name: "Viagens",
    color: "#5B21B6",
    icon: "shopping-bag",
    isDefault: false,
    status: CategoryStatus.ACTIVE,
    createdAt: new Date("2026-10-18T11:00:00.000Z"),
    updatedAt: new Date("2026-10-18T11:00:00.000Z"),
  });

  const cursosAntigos = new Category({
    id: "77000000-0000-4000-8000-000000000103",
    userId: ownerUserId,
    name: "Cursos Antigos",
    color: "#1E293B",
    icon: "graduation-cap",
    isDefault: false,
    status: CategoryStatus.INACTIVE,
    createdAt: new Date("2026-08-12T09:30:00.000Z"),
    updatedAt: new Date("2026-09-29T16:10:00.000Z"),
  });

  return [academia, viagens, cursosAntigos].map((category) => category.toJSON());
}

const CATEGORY_ID_BY_NAME = new Map<string, string>(
  DEFAULT_CATEGORY_DEFINITIONS.map((definition) => [definition.name, definition.id]),
);

const DEMO_ACCOUNT_IDS = {
  nubank: "76000000-0000-4000-8000-000000000001",
  itau: "76000000-0000-4000-8000-000000000002",
  santanderOld: "76000000-0000-4000-8000-000000000003",
  reserva: "76000000-0000-4000-8000-000000000004",
  xp: "76000000-0000-4000-8000-000000000006",
} as const;

export function createDemoTransactions(
  now: Date,
): Array<Prisma.TransactionUncheckedCreateInput & { id: string }> {
  const ownerUserId = DEMO_USERS[1]!.id;
  const createdAt = new Date(now.getTime() - 60 * 60 * 1000);

  const seedSpecs: Array<{
    id: string;
    accountId: string;
    categoryName: string;
    description: string;
    amount: number;
    type: TransactionType;
    status: TransactionStatus;
    transactionDate: string;
    notes?: string | null;
  }> = [
    {
      id: "78000000-0000-4000-8000-000000000001",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Alimentação",
      description: "Supermercado Zona Sul",
      amount: 468.9,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-14",
    },
    {
      id: "78000000-0000-4000-8000-000000000002",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Serviços",
      description: "Reembolso Consultoria UI",
      amount: 1450.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-12",
    },
    {
      id: "78000000-0000-4000-8000-000000000003",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Assinaturas",
      description: "Streaming e Nuvem",
      amount: 119.8,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.PENDING,
      transactionDate: "2026-11-16",
    },
    {
      id: "78000000-0000-4000-8000-000000000004",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Saúde",
      description: "Farmácia São Paulo",
      amount: 184.5,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-08",
    },
    {
      id: "78000000-0000-4000-8000-000000000005",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Lazer",
      description: "Restaurante Vila Madalena",
      amount: 242.0,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-05",
    },
    {
      id: "78000000-0000-4000-8000-000000000006",
      accountId: DEMO_ACCOUNT_IDS.itau,
      categoryName: "Salário",
      description: "Salário Mensal",
      amount: 9400.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-05",
    },
    {
      id: "78000000-0000-4000-8000-000000000007",
      accountId: DEMO_ACCOUNT_IDS.itau,
      categoryName: "Moradia",
      description: "Aluguel Apartamento",
      amount: 2450.0,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-06",
    },
    {
      id: "78000000-0000-4000-8000-000000000008",
      accountId: DEMO_ACCOUNT_IDS.itau,
      categoryName: "Moradia",
      description: "Condomínio e Água",
      amount: 690.0,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.PENDING,
      transactionDate: "2026-11-18",
    },
    {
      id: "78000000-0000-4000-8000-000000000009",
      accountId: DEMO_ACCOUNT_IDS.itau,
      categoryName: "Transporte",
      description: "Posto Shell",
      amount: 289.4,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-11",
    },
    {
      id: "78000000-0000-4000-8000-000000000010",
      accountId: DEMO_ACCOUNT_IDS.reserva,
      categoryName: "Poupança",
      description: "Aporte Reserva Novembro",
      amount: 1500.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-07",
    },
    {
      id: "78000000-0000-4000-8000-000000000011",
      accountId: DEMO_ACCOUNT_IDS.reserva,
      categoryName: "Rendimentos",
      description: "Rendimento Mensal",
      amount: 350.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-02",
    },
    {
      id: "78000000-0000-4000-8000-000000000012",
      accountId: DEMO_ACCOUNT_IDS.xp,
      categoryName: "Investimentos",
      description: "Tesouro Selic 2029",
      amount: 2450.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-09",
    },
    {
      id: "78000000-0000-4000-8000-000000000013",
      accountId: DEMO_ACCOUNT_IDS.xp,
      categoryName: "Tarifas",
      description: "Taxa de Custódia B3",
      amount: 400.0,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-11-03",
    },
    {
      id: "78000000-0000-4000-8000-000000000014",
      accountId: DEMO_ACCOUNT_IDS.santanderOld,
      categoryName: "Transferências",
      description: "Transferência de encerramento",
      amount: 500.0,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-09-14",
    },
    {
      id: "78000000-0000-4000-8000-000000000015",
      accountId: DEMO_ACCOUNT_IDS.santanderOld,
      categoryName: "Reembolsos",
      description: "Estorno tarifa bancária",
      amount: 45.9,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      transactionDate: "2026-09-10",
    },
    {
      id: "78000000-0000-4000-8000-000000000016",
      accountId: DEMO_ACCOUNT_IDS.nubank,
      categoryName: "Serviços",
      description: "Freela Redesign App",
      amount: 2800.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.PENDING,
      transactionDate: "2026-11-20",
      notes: "Parcela final após entrega das telas no Figma.",
    },
    {
      id: "78000000-0000-4000-8000-000000000017",
      accountId: DEMO_ACCOUNT_IDS.xp,
      categoryName: "Rendimentos",
      description: "Dividendos FIIs Novembro",
      amount: 420.0,
      type: TransactionType.INCOME,
      status: TransactionStatus.PENDING,
      transactionDate: "2026-11-19",
      notes: "Provento previsto para crédito na corretora.",
    },
  ];

  return seedSpecs.map((spec) => {
    const entity = Transaction.create({
      id: spec.id,
      userId: ownerUserId,
      accountId: spec.accountId,
      categoryId: CATEGORY_ID_BY_NAME.get(spec.categoryName) ?? null,
      description: spec.description,
      amount: spec.amount,
      type: spec.type,
      status: spec.status,
      transactionDate: spec.transactionDate,
      notes: spec.notes ?? null,
      now: createdAt,
    });
    return {
      ...entity.toJSON(),
      amount: entity.amount.toFixed(2),
      transactionDate: new Date(`${entity.transactionDate}T00:00:00.000Z`),
    };
  });
}
