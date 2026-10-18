import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import type { PasswordResetUnitOfWork } from "../../src/modules/auth/application/contracts/password-reset-unit-of-work.js";
import { Challenge, type RequestMetadata } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { ACCOUNT_REACTIVATION_MAX_ATTEMPTS, ACCOUNT_REACTIVATION_TOKEN_TTL_MS } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType } from "../../src/modules/auth/domain/enums/auth.enums.js";
import type { ChallengeRepository } from "../../src/modules/auth/domain/interfaces/challenge-repository.interface.js";
import type { RefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { InMemoryPasswordResetRateLimiter } from "../../src/modules/auth/infrastructure/security/in-memory-password-reset-rate-limiter.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import { confirmAccountReactivationSchema, requestAccountReactivationSchema } from "../../src/modules/auth/presentation/schemas/auth.schemas.js";

const now = new Date("2026-10-18T12:00:00.000Z");
const metadata: RequestMetadata = { location: null, userAgent: "Navegador", ipAddress: "127.0.0.1", deviceId: null };

function setup(options: { recipient?: { id: string; email: string } | null; failEmail?: boolean; failConsume?: boolean } = {}) {
  const recipient = options.recipient === undefined ? { id: "user-1", email: "teco@example.com" } : options.recipient;
  let storedChallenge: Challenge | null = null;
  let status = ChallengeStatus.REQUESTED;
  let attempts = 0;
  let consumedAt: Date | null = null;
  let reactivated = false;
  let reactivationCalls = 0;
  const emails: Array<{ email: string; reactivationUrl: string }> = [];
  const challengeRepository: ChallengeRepository = {
    save: async (challenge) => {
      storedChallenge = challenge;
      status = challenge.status;
      attempts = challenge.attempts;
      consumedAt = challenge.consumedAt;
    },
    findById: async (id) => {
      if (!storedChallenge || storedChallenge.id !== id) return null;
      return new Challenge({
        id: storedChallenge.id,
        purpose: storedChallenge.purpose,
        subjectType: storedChallenge.subjectType,
        subjectId: storedChallenge.subjectId,
        secretHash: storedChallenge.secretHash,
        status,
        attempts,
        maxAttempts: storedChallenge.maxAttempts,
        metadata: storedChallenge.metadata,
        expiresAt: storedChallenge.expiresAt,
        consumedAt,
        createdAt: storedChallenge.createdAt,
        updatedAt: now,
      });
    },
    registerInvalidAttempt: async () => false,
    completeIfUsable: async () => false,
    registerInvalidAttemptForPurpose: async (id, purpose, subjectType, maxAttempts, at) => {
      if (!storedChallenge || storedChallenge.id !== id || storedChallenge.purpose !== purpose
        || storedChallenge.subjectType !== subjectType || status !== ChallengeStatus.REQUESTED
        || storedChallenge.expiresAt <= at || attempts >= maxAttempts) return false;
      attempts += 1;
      if (attempts >= maxAttempts) status = ChallengeStatus.FAILED;
      return true;
    },
    completeIfUsableForPurpose: async (id, purpose, subjectType, maxAttempts, _metadata, at) => {
      if (!storedChallenge || storedChallenge.id !== id || storedChallenge.purpose !== purpose
        || storedChallenge.subjectType !== subjectType || status !== ChallengeStatus.REQUESTED
        || storedChallenge.expiresAt <= at || attempts >= maxAttempts || options.failConsume) return false;
      status = ChallengeStatus.COMPLETED;
      consumedAt = at;
      return true;
    },
    markFailed: async (id) => {
      if (storedChallenge?.id === id && status === ChallengeStatus.REQUESTED) status = ChallengeStatus.FAILED;
    },
  };
  const usersAuthGateway = {
    findCredentialsByIdentifier: async () => null,
    findActiveUserById: async () => null,
    findActivePasswordResetRecipient: async () => null,
    findActivePasswordResetRecipientById: async () => null,
    findInactiveAccountReactivationRecipient: async () => recipient,
    reactivateUserById: async (userId: string) => {
      reactivationCalls += 1;
      reactivated = userId === recipient?.id;
      return reactivated;
    },
    changePasswordHash: async () => undefined,
  };
  const unitOfWork: PasswordResetUnitOfWork = {
    execute: async <T>() => { throw new Error("Não esperado."); },
  };
  const refreshTokens: RefreshTokenRepository = {
    save: async () => undefined,
    findActiveById: async () => null,
    registerUse: async () => undefined,
    revoke: async () => undefined,
    revokeAllFromUser: async () => undefined,
  };
  const service = new AuthService(
    refreshTokens,
    { now: () => now },
    { hash: async () => "hash-value", matches: async (token, hash) => token === "secret-token" && hash === "hash-value" },
    { hash: async (password) => password, compare: async () => false },
    usersAuthGateway,
    { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } },
    { generate: () => "challenge-1" },
    {
      createSessionIfAccountActive: async () => true,
      deactivateAccountAndRevokeSessions: async () => true,
      reactivateAccountAndRevokeSessions: async () => ({ found: true, reactivated: true }),
    },
    {
      unitOfWork,
      challengeRepository,
      emailProvider: {
        sendPasswordReset: async () => undefined,
        sendPasswordChanged: async () => undefined,
        sendAccountReactivation: async (input) => {
          if (options.failEmail) throw new Error("Falha do provedor.");
          emails.push(input);
        },
      },
      tokenGenerator: { generate: () => "secret-token" },
      rateLimiter: new InMemoryPasswordResetRateLimiter(),
      frontendUrl: "https://carteira.example",
      logger: noopLogger,
    },
  );

  return {
    service,
    emails,
    get challenge() { return storedChallenge; },
    get status() { return status; },
    get attempts() { return attempts; },
    get reactivated() { return reactivated; },
    get reactivationCalls() { return reactivationCalls; },
  };
}

test("solicita reativação sem expor existência e envia link com segredo não persistido", async () => {
  const fixture = setup();
  await fixture.service.requestAccountReactivation({ email: " TECO@EXAMPLE.COM ", metadata });

  assert.equal(fixture.challenge?.purpose, ChallengePurpose.ACCOUNT_REACTIVATION);
  assert.equal(fixture.challenge?.subjectType, ChallengeSubjectType.USER);
  assert.equal(fixture.challenge?.secretHash, "hash-value");
  assert.equal(fixture.challenge?.maxAttempts, ACCOUNT_REACTIVATION_MAX_ATTEMPTS);
  assert.equal(fixture.challenge?.expiresAt.getTime(), now.getTime() + ACCOUNT_REACTIVATION_TOKEN_TTL_MS);
  assert.equal(fixture.emails[0]?.email, "teco@example.com");
  assert.equal(fixture.emails[0]?.reactivationUrl, "https://carteira.example/reactivate-account?token=challenge-1.secret-token");
  assert.equal(fixture.challenge?.secretHash.includes("secret-token"), false);
  assert.deepEqual(fixture.challenge?.metadata.issued, metadata);
});

test("schemas validam e-mail, token e rejeitam campos não reconhecidos", () => {
  assert.equal(requestAccountReactivationSchema.safeParse({ email: "teste@example.com" }).success, true);
  assert.equal(requestAccountReactivationSchema.safeParse({ email: "invalido" }).success, false);
  assert.equal(requestAccountReactivationSchema.safeParse({ email: "teste@example.com", userId: "outro-usuario" }).success, false);
  assert.equal(confirmAccountReactivationSchema.safeParse({ token: "challenge.secret" }).success, true);
  assert.equal(confirmAccountReactivationSchema.safeParse({ token: " " }).success, false);
});

test("não cria desafio nem envia e-mail quando não existe conta inativa", async () => {
  const fixture = setup({ recipient: null });
  await fixture.service.requestAccountReactivation({ email: "ausente@example.com", metadata });

  assert.equal(fixture.challenge, null);
  assert.deepEqual(fixture.emails, []);
});

test("marca o desafio como FAILED quando o envio do link falha", async () => {
  const fixture = setup({ failEmail: true });
  await fixture.service.requestAccountReactivation({ email: "teco@example.com", metadata });

  assert.equal(fixture.status, ChallengeStatus.FAILED);
  assert.deepEqual(fixture.emails, []);
});

test("confirma a reativação e consome o link uma única vez", async () => {
  const fixture = setup();
  await fixture.service.requestAccountReactivation({ email: "teco@example.com", metadata });
  await fixture.service.confirmAccountReactivation({ token: "challenge-1.secret-token", metadata });

  assert.equal(fixture.reactivated, true);
  assert.equal(fixture.status, ChallengeStatus.COMPLETED);
  await assert.rejects(fixture.service.confirmAccountReactivation({ token: "challenge-1.secret-token", metadata }));
});

test("marca o desafio como FAILED após três tentativas inválidas", async () => {
  const fixture = setup();
  await fixture.service.requestAccountReactivation({ email: "teco@example.com", metadata });

  for (let attempt = 0; attempt < ACCOUNT_REACTIVATION_MAX_ATTEMPTS; attempt += 1) {
    await assert.rejects(fixture.service.confirmAccountReactivation({ token: "challenge-1.segredo-incorreto", metadata }));
  }

  assert.equal(fixture.attempts, 3);
  assert.equal(fixture.status, ChallengeStatus.FAILED);
  assert.equal(fixture.reactivationCalls, 0);
});

test("duas confirmações concorrentes consomem o desafio uma única vez", async () => {
  const fixture = setup();
  await fixture.service.requestAccountReactivation({ email: "teco@example.com", metadata });
  const input = { token: "challenge-1.secret-token", metadata };
  const results = await Promise.allSettled([
    fixture.service.confirmAccountReactivation(input),
    fixture.service.confirmAccountReactivation(input),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(fixture.status, ChallengeStatus.COMPLETED);
  assert.equal(fixture.reactivationCalls, 1);
});

test("não reativa a conta se o consumo atômico do desafio falhar", async () => {
  const fixture = setup({ failConsume: true });
  await fixture.service.requestAccountReactivation({ email: "teco@example.com", metadata });

  await assert.rejects(fixture.service.confirmAccountReactivation({ token: "challenge-1.secret-token", metadata }));

  assert.equal(fixture.reactivated, false);
  assert.equal(fixture.reactivationCalls, 0);
  assert.equal(fixture.status, ChallengeStatus.REQUESTED);
});
