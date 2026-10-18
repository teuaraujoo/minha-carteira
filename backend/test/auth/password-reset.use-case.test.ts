import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { PasswordResetRequest } from "../../src/modules/auth/domain/entities/password-reset-request.entity.js";
import type { RequestMetadata } from "../../src/modules/auth/domain/interfaces/auth.interfaces.js";
import type { IChallengeRepository } from "../../src/modules/auth/domain/interfaces/challenge-repository.interface.js";
import type { IPasswordResetRequestRepository } from "../../src/modules/auth/domain/interfaces/password-reset-request-repository.interface.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import type { UsersAuthGateway } from "../../src/modules/users/index.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType, PasswordResetRequestStatus, RefreshTokenRevokeReason } from "../../src/modules/auth/domain/enums/auth.enums.js";
import { InMemoryPasswordResetRateLimiter } from "../../src/modules/auth/infrastructure/security/in-memory-password-reset-rate-limiter.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const now = new Date("2026-10-18T12:00:00.000Z");
const metadata: RequestMetadata = { location: null, userAgent: "Teste", ipAddress: "127.0.0.1", deviceId: null };

interface MemoryPasswordResetTransaction {
  requests: IPasswordResetRequestRepository;
  challenges: IChallengeRepository;
  refreshTokens: IRefreshTokenRepository;
  users: UsersAuthGateway;
}

function createPrisma(transaction: MemoryPasswordResetTransaction): PrismaClient {
  const prismaTransaction = {
    passwordResetRequest: {
      create: async ({ data }: { data: ConstructorParameters<typeof PasswordResetRequest>[0] }) => transaction.requests.save(new PasswordResetRequest(data)),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const request = await transaction.requests.findById(where.id);
        return request ? {
          id: request.id, userId: request.userId, status: request.status,
          requestedAt: request.requestedAt, expiresAt: request.expiresAt, metadata: request.metadata,
          completedAt: request.completedAt, cancelledAt: request.cancelledAt,
          createdAt: request.createdAt, updatedAt: request.updatedAt,
        } : null;
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: { status: string; completedAt?: Date; updatedAt: Date } }) => {
        if (data.status === "COMPLETED") return { count: await transaction.requests.complete(where.id, data.completedAt ?? data.updatedAt) ? 1 : 0 };
        await transaction.requests.markFailed(where.id, data.updatedAt);
        return { count: 1 };
      },
    },
    challenge: {
      create: async ({ data }: { data: ConstructorParameters<typeof Challenge>[0] }) => transaction.challenges.save(new Challenge(data)),
      findUnique: async (input: { where: { id: string }; select?: { attempts: boolean; maxAttempts: boolean } }) => {
        const challenge = await transaction.challenges.findById(input.where.id);
        if (!challenge) return null;
        return input.select ? { attempts: challenge.attempts, maxAttempts: challenge.maxAttempts } : {
          id: challenge.id, purpose: challenge.purpose, subjectType: challenge.subjectType,
          subjectId: challenge.subjectId, secretHash: challenge.secretHash, status: challenge.status,
          attempts: challenge.attempts, maxAttempts: challenge.maxAttempts, metadata: challenge.metadata,
          expiresAt: challenge.expiresAt, consumedAt: challenge.consumedAt,
          createdAt: challenge.createdAt, updatedAt: challenge.updatedAt,
        };
      },
      updateMany: async ({ where, data }: { where: { id: string; purpose?: Challenge["purpose"]; subjectType?: Challenge["subjectType"]; attempts?: { lt: number } }; data: { status?: string; attempts?: { increment: number }; metadata?: Challenge["metadata"]; consumedAt?: Date; updatedAt: Date } }) => {
        if (data.attempts) {
          const updated = await transaction.challenges.registerInvalidAttemptForPurpose(
            where.id, where.purpose ?? ChallengePurpose.PASSWORD_RESET,
            where.subjectType ?? ChallengeSubjectType.PASSWORD_RESET_REQUEST,
            where.attempts?.lt ?? 3, data.updatedAt,
          );
          return { count: updated ? 1 : 0 };
        }
        if (data.status === "COMPLETED") {
          const completed = await transaction.challenges.completeIfUsable(
            where.id, data.metadata!, data.consumedAt ?? data.updatedAt,
          );
          return { count: completed ? 1 : 0 };
        }
        await transaction.challenges.markFailed(where.id, data.updatedAt);
        return { count: 1 };
      },
    },
    refreshToken: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date; revokeReason: "PASSWORD_RESET" } }) => {
        await transaction.refreshTokens.revokeAllFromUser(where.userId, data.revokedAt, data.revokeReason as RefreshTokenRevokeReason);
        return { count: 1 };
      },
    },
    user: {
      findFirst: async ({ where }: { where: { id: string } }) => transaction.users.findActivePasswordResetRecipientById(where.id),
      updateMany: async ({ where, data }: { where: { id: string }; data: { passwordHash: string } }) => {
        await transaction.users.changePasswordHash(where.id, data.passwordHash);
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  return {
    $transaction: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => operation(prismaTransaction),
  } as unknown as PrismaClient;
}

function setup(options: { activeRecipient?: { id: string; email: string } | null; failEmail?: boolean } = {}) {
  let request: PasswordResetRequest | null = null;
  let challenge: Challenge | null = null;
  let challengeAttempts = 0;
  let challengeFailed = false;
  let requestCompleted = false;
  let challengeCompleted = false;
  let changedPasswordHash: string | null = null;
  const revoked: Array<{ userId: string; reason: RefreshTokenRevokeReason }> = [];
  const emails: string[] = [];
  const sentResetUrls: string[] = [];
  const recipient = options.activeRecipient === undefined ? { id: "user-1", email: "teco@example.com" } : options.activeRecipient;
  const transaction: MemoryPasswordResetTransaction = {
    requests: {
      save: async (value) => { request = value; },
      findById: async (id) => request?.id === id && !requestCompleted ? request : null,
      complete: async (id, at) => {
        if (request?.id !== id || !request.isPendingAt(at) || requestCompleted) return false;
        requestCompleted = true;
        return true;
      },
      markFailed: async (id) => { if (request?.id === id) requestFailed = true; },
      deleteWithChallenges: async () => undefined,
    },
    challenges: {
      save: async (value) => { challenge = value; },
      findById: async (id) => challenge?.id === id && !challengeFailed && !challengeCompleted ? challenge : null,
      registerInvalidAttempt: async (id) => {
        if (challenge?.id !== id || challengeFailed || challengeCompleted) return false;
        challengeAttempts += 1;
        if (challengeAttempts >= challenge.maxAttempts) challengeFailed = true;
        return true;
      },
      completeIfUsable: async (id) => {
        if (challenge?.id !== id || challengeFailed || challengeCompleted) return false;
        challengeCompleted = true;
        return true;
      },
      registerInvalidAttemptForPurpose: async (id, _purpose, _subjectType, maxAttempts) => {
        if (challenge?.id !== id || challengeFailed || challengeCompleted) return false;
        challengeAttempts += 1;
        if (challengeAttempts >= maxAttempts) challengeFailed = true;
        return true;
      },
      completeIfUsableForPurpose: async (id) => {
        if (challenge?.id !== id || challengeFailed || challengeCompleted) return false;
        challengeCompleted = true;
        return true;
      },
      markFailed: async (id) => { if (challenge?.id === id) challengeFailed = true; },
    },
    refreshTokens: {
      save: async () => undefined,
      findActiveById: async () => null,
      registerUse: async () => undefined,
      revoke: async () => undefined,
      revokeAllFromUser: async (userId, _at, reason) => { revoked.push({ userId, reason }); },
    },
    users: {
      findCredentialsByIdentifier: async () => null,
      findActiveUserById: async () => null,
      findActivePasswordResetRecipient: async () => recipient,
      findActivePasswordResetRecipientById: async (id) => id === recipient?.id ? recipient : null,
      findInactiveAccountReactivationRecipient: async () => null,
      reactivateUserById: async () => false,
      changePasswordHash: async (_id, hash) => { changedPasswordHash = hash; },
    },
  };
  let requestFailed = false;
  const prisma = createPrisma(transaction);
  let id = 0;
  const service = new AuthService(
    transaction.refreshTokens,
    { now: () => now },
    { hash: async (token) => `hash:${token}`, matches: async (token, expected) => expected === `hash:${token}` },
    { hash: async (password) => `password-hash:${password}`, compare: async () => false },
    transaction.users,
    { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } },
    { generate: () => `generated-${++id}` },
    prisma,
    {
      challengeRepository: transaction.challenges,
      emailProvider: {
        sendPasswordReset: async (input) => { if (options.failEmail) throw new Error("Falha do provedor."); emails.push(input.email); sentResetUrls.push(input.resetUrl); },
        sendPasswordChanged: async (input) => { emails.push(input.email); },
        sendAccountReactivation: async (input) => { emails.push(input.email); sentResetUrls.push(input.reactivationUrl); },
      },
      tokenGenerator: { generate: () => "secret-token" },
      rateLimiter: new InMemoryPasswordResetRateLimiter(),
      frontendUrl: "https://carteira.example",
      logger: noopLogger,
    },
  );
  return {
    service,
    get request() { return request; },
    get challenge() { return challenge; },
    get requestFailed() { return requestFailed; },
    get challengeFailed() { return challengeFailed; },
    get challengeAttempts() { return challengeAttempts; },
    get requestCompleted() { return requestCompleted; },
    get challengeCompleted() { return challengeCompleted; },
    get changedPasswordHash() { return changedPasswordHash; },
    revoked,
    emails,
    sentResetUrls,
  };
}

test("solicitação grava somente o hash do segredo e envia link neutro", async () => {
  const fixture = setup();
  await fixture.service.requestPasswordReset({ email: " TECO@EXAMPLE.COM ", metadata });

  assert.equal(fixture.request?.status, PasswordResetRequestStatus.PENDING);
  assert.equal(fixture.challenge?.secretHash, "hash:secret-token");
  assert.equal(fixture.challenge?.secretHash.includes("challengeId.secret"), false);
  assert.equal(fixture.sentResetUrls[0], "https://carteira.example/reset-password?token=generated-2.secret-token");
  assert.deepEqual(fixture.emails, ["teco@example.com"]);
});

test("e-mail ausente não cria registro nem envia mensagem", async () => {
  const fixture = setup({ activeRecipient: null });
  await fixture.service.requestPasswordReset({ email: "ausente@example.com", metadata });
  assert.equal(fixture.request, null);
  assert.equal(fixture.challenge, null);
  assert.deepEqual(fixture.emails, []);
});

test("falha de envio marca solicitação e desafio como falhos sem propagar", async () => {
  const fixture = setup({ failEmail: true });
  await fixture.service.requestPasswordReset({ email: "teco@example.com", metadata });
  assert.equal(fixture.requestFailed, true);
  assert.equal(fixture.challengeFailed, true);
});

test("confirmação atualiza senha, consome desafio e revoga sessões na unidade transacional", async () => {
  const fixture = setup();
  await fixture.service.requestPasswordReset({ email: "teco@example.com", metadata });
  await fixture.service.confirmPasswordReset({ token: "generated-2.secret-token", password: "nova-senha-segura", passwordConfirmation: "nova-senha-segura", metadata });

  assert.equal(fixture.requestCompleted, true);
  assert.equal(fixture.challengeCompleted, true);
  assert.equal(fixture.changedPasswordHash, "password-hash:nova-senha-segura");
  assert.deepEqual(fixture.revoked, [{ userId: "user-1", reason: RefreshTokenRevokeReason.PASSWORD_RESET }]);
  assert.deepEqual(fixture.emails, ["teco@example.com", "teco@example.com"]);
});

test("três segredos inválidos marcam o desafio como FAILED sem trocar a senha", async () => {
  const fixture = setup();
  await fixture.service.requestPasswordReset({ email: "teco@example.com", metadata });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.rejects(fixture.service.confirmPasswordReset({ token: "generated-2.segredo-errado", password: "nova-senha-segura", passwordConfirmation: "nova-senha-segura", metadata }));
  }
  assert.equal(fixture.challengeAttempts, 3);
  assert.equal(fixture.challengeFailed, true);
  assert.equal(fixture.changedPasswordHash, null);
});

test("confirmação concorrente consome o desafio uma única vez", async () => {
  const fixture = setup();
  await fixture.service.requestPasswordReset({ email: "teco@example.com", metadata });
  const input = { token: "generated-2.secret-token", password: "nova-senha-segura", passwordConfirmation: "nova-senha-segura", metadata };
  const results = await Promise.allSettled([
    fixture.service.confirmPasswordReset(input),
    fixture.service.confirmPasswordReset(input),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(fixture.revoked.length, 1);
  assert.equal(fixture.changedPasswordHash, "password-hash:nova-senha-segura");
});

test("limitador bloqueia novos endereços no teto de 10.000 chaves e libera janela expirada", () => {
  const limiter = new InMemoryPasswordResetRateLimiter();
  for (let key = 0; key < 5_000; key += 1) {
    assert.equal(limiter.consume(`email-${key}`, `ip-${key}`, now), true);
  }
  assert.equal(limiter.consume("email-novo", "ip-novo", now), false);
  assert.equal(limiter.consume("email-0", "ip-0", new Date(now.getTime() + 60 * 60 * 1000)), true);
});

test("limitador aplica os limites independentes por e-mail e por IP", () => {
  const emailLimiter = new InMemoryPasswordResetRateLimiter();
  assert.equal(emailLimiter.consume("email", "ip-1", now), true);
  assert.equal(emailLimiter.consume("email", "ip-2", now), true);
  assert.equal(emailLimiter.consume("email", "ip-3", now), true);
  assert.equal(emailLimiter.consume("email", "ip-4", now), false);

  const ipLimiter = new InMemoryPasswordResetRateLimiter();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(ipLimiter.consume(`email-${attempt}`, "mesmo-ip", now), true);
  }
  assert.equal(ipLimiter.consume("email-extra", "mesmo-ip", now), false);
});
