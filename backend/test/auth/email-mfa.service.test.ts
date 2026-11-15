import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { JwtProvider, TokenHasher } from "../../src/modules/auth/application/contracts/auth.contracts.js";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import {
  MFA_CODE_TTL_MS,
  MFA_MAX_ATTEMPTS,
  MFA_RATE_LIMIT_WINDOW_MS,
  MFA_RESEND_COOLDOWN_MS,
} from "../../src/modules/auth/domain/constants/auth.constants.js";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { RefreshToken } from "../../src/modules/auth/domain/entities/refresh-token.entity.js";
import {
  ChallengePurpose,
  ChallengeStatus,
  ChallengeSubjectType,
} from "../../src/modules/auth/domain/enums/auth.enums.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import type { RequestMetadata } from "../../src/modules/auth/domain/interfaces/auth.interfaces.js";
import { InMemoryPasswordResetRateLimiter } from "../../src/modules/auth/infrastructure/security/in-memory-password-reset-rate-limiter.js";
import { JsonWebTokenProvider } from "../../src/modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { Sha256TokenHasher } from "../../src/modules/auth/infrastructure/security/sha256-token.hasher.js";
import { PrismaChallengeRepository } from "../../src/modules/auth/infrastructure/repositories/challenge.repository.js";
import type { UserService } from "../../src/modules/users/application/services/users.service.js";
import { UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import type { UserAuthEmailStatus } from "../../src/modules/users/index.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import type { PasswordHasher } from "../../src/shared/application/security/password-hasher.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const requestMetadata: RequestMetadata = {
  location: { latitude: -3.7, longitude: -38.5 },
  userAgent: "Navegador MFA",
  ipAddress: "127.0.0.1",
  deviceId: "device-mfa-1",
};

interface StoredChallengeRow {
  id: string;
  purpose: string;
  subjectType: string;
  subjectId: string | null;
  targetEmail: string | null;
  secretHash: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  metadata: unknown;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createMfaFixture(options: {
  existingUser?: UserAuthEmailStatus | null;
  failEmail?: boolean;
  failConsume?: boolean;
} = {}) {
  const rows: StoredChallengeRow[] = [];
  const savedSessions: RefreshToken[] = [];
  const sentEmails: Array<{ email: string; code: string; expiresInMinutes: number }> = [];
  let failEmail = options.failEmail ?? false;

  const challengeClient = {
    create: async ({ data }: { data: StoredChallengeRow }) => {
      const cloned: StoredChallengeRow = { ...data, metadata: structuredClone(data.metadata) };
      rows.push(cloned);
      return cloned;
    },
    findUnique: async ({ where, select }: { where: { id: string }; select?: { attempts?: boolean; maxAttempts?: boolean } }) => {
      const found = rows.find((item) => item.id === where.id);
      if (!found) return null;
      if (select) {
        return { attempts: found.attempts, maxAttempts: found.maxAttempts };
      }
      return { ...found, metadata: structuredClone(found.metadata) };
    },
    findFirst: async ({ where, orderBy }: {
      where: { purpose?: string; subjectType?: string; targetEmail?: string };
      orderBy?: Array<Record<string, "asc" | "desc">>;
    }) => {
      const matches = rows.filter((item) =>
        (where.purpose === undefined || item.purpose === where.purpose)
        && (where.subjectType === undefined || item.subjectType === where.subjectType)
        && (where.targetEmail === undefined || item.targetEmail === where.targetEmail),
      );
      if (orderBy) {
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
      }
      const first = matches[0];
      return first ? { ...first, metadata: structuredClone(first.metadata) } : null;
    },
    count: async ({ where }: { where: { purpose?: string; subjectType?: string; targetEmail?: string; createdAt?: { gte?: Date } } }) => {
      return rows.filter((item) =>
        (where.purpose === undefined || item.purpose === where.purpose)
        && (where.subjectType === undefined || item.subjectType === where.subjectType)
        && (where.targetEmail === undefined || item.targetEmail === where.targetEmail)
        && (where.createdAt?.gte === undefined || item.createdAt.getTime() >= where.createdAt.gte.getTime()),
      ).length;
    },
    updateMany: async ({ where, data }: {
      where: {
        id?: string;
        purpose?: string;
        subjectType?: string;
        targetEmail?: string;
        status?: string;
        expiresAt?: { gt?: Date };
        attempts?: { lt?: number };
      };
      data: {
        status?: string;
        attempts?: { increment: number };
        consumedAt?: Date;
        metadata?: unknown;
        updatedAt: Date;
      };
    }) => {
      if (options.failConsume && data.status === "COMPLETED") return { count: 0 };
      let count = 0;
      for (const item of rows) {
        if (where.id !== undefined && item.id !== where.id) continue;
        if (where.purpose !== undefined && item.purpose !== where.purpose) continue;
        if (where.subjectType !== undefined && item.subjectType !== where.subjectType) continue;
        if (where.targetEmail !== undefined && item.targetEmail !== where.targetEmail) continue;
        if (where.status !== undefined && item.status !== where.status) continue;
        if (where.expiresAt?.gt !== undefined && item.expiresAt.getTime() <= where.expiresAt.gt.getTime()) continue;
        if (where.attempts?.lt !== undefined && item.attempts >= where.attempts.lt) continue;

        count += 1;
        if (data.attempts?.increment !== undefined) item.attempts += data.attempts.increment;
        if (data.status !== undefined) item.status = data.status;
        if (data.consumedAt !== undefined) item.consumedAt = data.consumedAt;
        if (data.metadata !== undefined) item.metadata = structuredClone(data.metadata);
        item.updatedAt = data.updatedAt;
      }
      return { count };
    },
  };

  const transactionClient = {
    $executeRaw: async () => 0,
    $queryRaw: async () => {
      if (!options.existingUser || options.existingUser.status !== UserStatus.ACTIVE) return [];
      return [{ status: options.existingUser.status }];
    },
    challenge: challengeClient,
    refreshToken: {
      create: async ({ data }: { data: ConstructorParameters<typeof RefreshToken>[0] }) => {
        savedSessions.push(new RefreshToken(data));
      },
    },
  } as unknown as Prisma.TransactionClient;

  const prisma = {
    challenge: challengeClient,
    $transaction: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => operation(transactionClient),
  } as unknown as PrismaClient;

  const challengeRepository = new PrismaChallengeRepository(prisma);
  const refreshTokenRepository: IRefreshTokenRepository = {
    save: async (session) => { savedSessions.push(session); },
    findActiveById: async () => null,
    registerUse: async () => undefined,
    revoke: async () => undefined,
    revokeAllFromUser: async () => undefined,
  };
  const tokenHasher: TokenHasher = new Sha256TokenHasher();
  const passwordHasher: PasswordHasher = { hash: async (v) => v, compare: async () => false };
  const jwtProvider: JwtProvider = new JsonWebTokenProvider("segredo-mfa-testes-unitario", "minha-carteira-api");
  const userService = {
    findAuthStatusByEmail: async (email: string) => {
      if (!options.existingUser) return null;
      return options.existingUser.email === email ? options.existingUser : null;
    },
  } as unknown as UserService;

  const service = new AuthService(
    refreshTokenRepository,
    tokenHasher,
    passwordHasher,
    userService,
    jwtProvider,
    prisma,
    challengeRepository,
    {
      emailProvider: {
        sendPasswordReset: async () => undefined,
        sendPasswordChanged: async () => undefined,
        sendAccountReactivation: async () => undefined,
        sendMfaCode: async (input) => {
          if (failEmail) throw new Error("Falha simulada no provedor.");
          sentEmails.push(input);
        },
      },
      tokenGenerator: { generate: () => "unused" },
      rateLimiter: new InMemoryPasswordResetRateLimiter(),
      frontendUrl: "https://carteira.example",
      logger: noopLogger,
    },
  );

  return {
    service,
    rows,
    savedSessions,
    sentEmails,
    jwtProvider,
    setFailEmail: (value: boolean) => { failEmail = value; },
  };
}

test("requestMfa gera código de 6 dígitos vinculado ao challengeId, aplica cooldown de 45s/15min e invalida desafio anterior", async (t) => {
  const start = new Date("2026-11-15T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: start });

  const fixture = createMfaFixture();

  const first = await fixture.service.requestMfa({ email: " TECO@EXAMPLE.COM ", metadata: requestMetadata });
  assert.equal(first.sent, true);
  assert.equal(first.nextAttemptAt.getTime(), start.getTime() + MFA_RESEND_COOLDOWN_MS);
  assert.equal(fixture.sentEmails.length, 1);
  assert.equal(fixture.sentEmails[0]?.email, "teco@example.com");
  assert.match(fixture.sentEmails[0]?.code ?? "", /^\d{6}$/);
  assert.equal(fixture.sentEmails[0]?.expiresInMinutes, 5);

  const row1 = fixture.rows[0]!;
  assert.equal(row1.purpose, ChallengePurpose.EMAIL_VERIFICATION);
  assert.equal(row1.subjectType, ChallengeSubjectType.EMAIL);
  assert.equal(row1.subjectId, null);
  assert.equal(row1.targetEmail, "teco@example.com");
  assert.equal(row1.expiresAt.getTime(), start.getTime() + MFA_CODE_TTL_MS);
  assert.equal(row1.secretHash.includes(fixture.sentEmails[0]!.code), false);

  await assert.rejects(
    fixture.service.requestMfa({ email: "teco@example.com", metadata: requestMetadata }),
    (error: unknown) => error instanceof AppError && error.status === 429 && error.code === ErrorCode.RATE_LIMIT_EXCEEDED,
  );

  t.mock.timers.tick(MFA_RESEND_COOLDOWN_MS);
  const second = await fixture.service.requestMfa({ email: "teco@example.com", metadata: requestMetadata });
  assert.equal(fixture.rows[0]?.status, ChallengeStatus.EXPIRED);
  assert.equal(second.nextAttemptAt.getTime(), start.getTime() + MFA_RESEND_COOLDOWN_MS * 2);

  t.mock.timers.tick(MFA_RESEND_COOLDOWN_MS);
  const third = await fixture.service.requestMfa({ email: "teco@example.com", metadata: requestMetadata });
  assert.equal(fixture.rows[1]?.status, ChallengeStatus.EXPIRED);
  assert.equal(third.nextAttemptAt.getTime(), start.getTime() + MFA_RESEND_COOLDOWN_MS * 2 + MFA_RATE_LIMIT_WINDOW_MS);

  t.mock.timers.tick(MFA_RESEND_COOLDOWN_MS);
  await assert.rejects(
    fixture.service.requestMfa({ email: "teco@example.com", metadata: requestMetadata }),
    (error: unknown) => error instanceof AppError && error.status === 429 && error.code === ErrorCode.RATE_LIMIT_EXCEEDED,
  );
});

test("requestMfa marca desafio como FAILED e propaga erro 502 quando o envio falha", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-15T12:00:00.000Z") });
  const fixture = createMfaFixture({ failEmail: true });

  await assert.rejects(
    fixture.service.requestMfa({ email: "novo@example.com", metadata: requestMetadata }),
    (error: unknown) => error instanceof AppError && error.status === 502,
  );
  assert.equal(fixture.rows[0]?.status, ChallengeStatus.FAILED);
});

test("validateMfa emite token de onboarding e grava payload JWT completo em metadata para usuário novo", async (t) => {
  const start = new Date("2026-11-15T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: start });
  const fixture = createMfaFixture({ existingUser: null });

  const requested = await fixture.service.requestMfa({ email: "novo@example.com", metadata: requestMetadata });
  const code = fixture.sentEmails[0]!.code;

  const validated = await fixture.service.validateMfa({
    challengeId: requested.challengeId,
    code,
    metadata: requestMetadata,
  });

  assert.equal(validated.isRegistered, false);
  assert.equal(validated.refreshToken, undefined);
  assert.equal(fixture.savedSessions.length, 0);

  const verified = await fixture.jwtProvider.verifyOnboardingToken(validated.accessToken);
  assert.equal(verified.email, "novo@example.com");
  assert.equal(verified.challengeId, requested.challengeId);
  assert.equal(verified.type, "onboarding");
  assert.equal(verified.issuer, "minha-carteira-api");
  assert.equal(verified.expiresAt.getTime() - verified.issuedAt.getTime(), 15 * 60 * 1000);

  const savedChallenge = new Challenge({
    ...(fixture.rows[0]!),
    purpose: fixture.rows[0]!.purpose as ChallengePurpose,
    subjectType: fixture.rows[0]!.subjectType as ChallengeSubjectType,
    status: fixture.rows[0]!.status as ChallengeStatus,
    metadata: fixture.rows[0]!.metadata as Challenge["metadata"],
  });
  assert.equal(savedChallenge.status, ChallengeStatus.COMPLETED);
  assert.equal(savedChallenge.consumedAt?.getTime(), start.getTime());
  assert.deepEqual(savedChallenge.metadata.consumed, requestMetadata);
  assert.equal(savedChallenge.metadata.tokenPayload?.sub, "novo@example.com");
  assert.equal(savedChallenge.metadata.tokenPayload?.cid, requested.challengeId);
  assert.equal(savedChallenge.metadata.tokenPayload?.type, "onboarding");
  assert.equal(savedChallenge.metadata.tokenPayload?.iss, "minha-carteira-api");
});

test("validateMfa inicia sessão com RefreshToken para usuário ACTIVE existente e rejeita reutilização", async (t) => {
  const start = new Date("2026-11-15T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: start });
  const fixture = createMfaFixture({
    existingUser: { id: "user-active-1", email: "ativo@example.com", status: UserStatus.ACTIVE },
  });

  const requested = await fixture.service.requestMfa({ email: "ativo@example.com", metadata: requestMetadata });
  const code = fixture.sentEmails[0]!.code;

  const validated = await fixture.service.validateMfa({
    challengeId: requested.challengeId,
    code,
    metadata: requestMetadata,
  });

  assert.equal(validated.isRegistered, true);
  assert.ok(validated.refreshToken);
  assert.equal(fixture.savedSessions.length, 1);
  assert.equal(fixture.savedSessions[0]?.userId, "user-active-1");

  const verifiedAccess = await fixture.jwtProvider.verifyAccessToken(validated.accessToken);
  assert.equal(verifiedAccess.userId, "user-active-1");
  assert.equal(verifiedAccess.type, "access");
  assert.equal(fixture.rows[0]?.status, ChallengeStatus.COMPLETED);

  await assert.rejects(
    fixture.service.validateMfa({ challengeId: requested.challengeId, code, metadata: requestMetadata }),
    (error: unknown) => error instanceof AppError && error.status === 400 && error.code === ErrorCode.VALIDATION_ERROR,
  );
});

test("validateMfa bloqueia conta INACTIVE com 403 e registra tentativas incorretas até FAILED na 3ª falha", async (t) => {
  const start = new Date("2026-11-15T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: start });

  const inactiveFixture = createMfaFixture({
    existingUser: { id: "user-inactive-1", email: "inativo@example.com", status: UserStatus.INACTIVE },
  });
  const inactiveReq = await inactiveFixture.service.requestMfa({ email: "inativo@example.com", metadata: requestMetadata });
  await assert.rejects(
    inactiveFixture.service.validateMfa({
      challengeId: inactiveReq.challengeId,
      code: inactiveFixture.sentEmails[0]!.code,
      metadata: requestMetadata,
    }),
    (error: unknown) => error instanceof AppError && error.status === 403 && error.code === ErrorCode.FORBIDDEN,
  );
  assert.equal(inactiveFixture.savedSessions.length, 0);

  const retryFixture = createMfaFixture({ existingUser: null });
  const retryReq = await retryFixture.service.requestMfa({ email: "erro@example.com", metadata: requestMetadata });
  const wrongCode = retryFixture.sentEmails[0]!.code === "000000" ? "111111" : "000000";

  for (let attempt = 1; attempt <= MFA_MAX_ATTEMPTS; attempt += 1) {
    await assert.rejects(
      retryFixture.service.validateMfa({
        challengeId: retryReq.challengeId,
        code: wrongCode,
        metadata: requestMetadata,
      }),
      (error: unknown) => error instanceof AppError && error.status === 400 && error.code === ErrorCode.VALIDATION_ERROR,
    );
  }
  assert.equal(retryFixture.rows[0]?.attempts, MFA_MAX_ATTEMPTS);
  assert.equal(retryFixture.rows[0]?.status, ChallengeStatus.FAILED);
});

test("validateMfa rejeita código expirado após 5 minutos", async (t) => {
  const start = new Date("2026-11-15T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: start });
  const fixture = createMfaFixture();

  const req = await fixture.service.requestMfa({ email: "expirado@example.com", metadata: requestMetadata });
  const code = fixture.sentEmails[0]!.code;
  t.mock.timers.tick(MFA_CODE_TTL_MS);

  await assert.rejects(
    fixture.service.validateMfa({ challengeId: req.challengeId, code, metadata: requestMetadata }),
    (error: unknown) => error instanceof AppError && error.status === 400 && error.code === ErrorCode.VALIDATION_ERROR,
  );
});
