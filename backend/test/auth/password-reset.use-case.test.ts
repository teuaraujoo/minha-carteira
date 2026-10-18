import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import type { PasswordResetTransaction, PasswordResetUnitOfWork } from "../../src/modules/auth/application/contracts/password-reset-unit-of-work.js";
import type { Challenge, PasswordResetRequest, RequestMetadata } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType, PasswordResetRequestStatus, RefreshTokenRevokeReason } from "../../src/modules/auth/domain/enums/auth.enums.js";
import { InMemoryPasswordResetRateLimiter } from "../../src/modules/auth/infrastructure/security/in-memory-password-reset-rate-limiter.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const now = new Date("2026-10-18T12:00:00.000Z");
const metadata: RequestMetadata = { location: null, userAgent: "Teste", ipAddress: "127.0.0.1", deviceId: null };

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
  const transaction: PasswordResetTransaction = {
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
      changePasswordHash: async (_id, hash) => { changedPasswordHash = hash; },
    },
  };
  let requestFailed = false;
  const unitOfWork: PasswordResetUnitOfWork = { execute: async (operation) => operation(transaction) };
  let id = 0;
  const service = new AuthService(
    transaction.refreshTokens,
    { now: () => now },
    { hash: async (token) => `hash:${token}`, matches: async (token, expected) => expected === `hash:${token}` },
    { hash: async (password) => `password-hash:${password}`, compare: async () => false },
    transaction.users,
    { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } },
    { generate: () => `generated-${++id}` },
    {
      unitOfWork,
      emailProvider: {
        sendPasswordReset: async (input) => { if (options.failEmail) throw new Error("Falha do provedor."); emails.push(input.email); sentResetUrls.push(input.resetUrl); },
        sendPasswordChanged: async (input) => { emails.push(input.email); },
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
