import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { RefreshTokenRevokeReason } from "../../src/modules/auth/domain/enums/auth.enums.js";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

const revokedAt = new Date("2026-01-02T12:00:00.000Z");

function setup() {
  const calls: Array<{ id: string; at: Date; reason: RefreshTokenRevokeReason }> = [];
  const alreadyRevoked = new Set<string>();
  let effectiveRevocations = 0;
  const repository = {
    async save() { throw new Error("Não esperado."); },
    async findActiveById() { throw new Error("Não esperado."); },
    async registerUse() { throw new Error("Não esperado."); },
    async revoke(id: string, at: Date, reason: RefreshTokenRevokeReason) {
      calls.push({ id, at, reason });
      if (alreadyRevoked.has(id)) return;
      alreadyRevoked.add(id);
      effectiveRevocations += 1;
    },
    async revokeAllFromUser() { throw new Error("Não esperado."); },
  } as IRefreshTokenRepository;
  const clock: ClockProvider = { now: () => revokedAt };
  return {
    service: new AuthService(repository, clock, { hash: async () => "", matches: async () => false }, { hash: async () => "", compare: async () => false }, { findCredentialsByIdentifier: async () => null, findActiveUserById: async () => null, findActivePasswordResetRecipient: async () => null, findActivePasswordResetRecipientById: async () => null, findInactiveAccountReactivationRecipient: async () => null, reactivateUserById: async () => false, changePasswordHash: async () => undefined }, { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } }, { generate: () => "" }, {} as PrismaClient),
    calls,
    alreadyRevoked,
    get effectiveRevocations() { return effectiveRevocations; },
  };
}

test("revoga a sessão atual com motivo LOGOUT e data do clock", async () => {
  const fixture = setup();
  await fixture.service.logout({ sessionId: "session-1" });

  assert.deepEqual(fixture.calls, [{
    id: "session-1", at: revokedAt, reason: RefreshTokenRevokeReason.LOGOUT,
  }]);
  assert.equal(fixture.alreadyRevoked.has("session-1"), true);
  assert.equal(fixture.effectiveRevocations, 1);
});

test("logout repetido e sessão ausente permanecem idempotentes", async () => {
  const fixture = setup();
  await fixture.service.logout({ sessionId: "session-1" });
  await fixture.service.logout({ sessionId: "session-1" });
  await fixture.service.logout({ sessionId: null });
  await fixture.service.logout({ sessionId: " " });

  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.effectiveRevocations, 1);
});

test("propaga falhas de persistência para que a camada HTTP não confirme falso sucesso", async () => {
  const expectedError = new Error("Falha de persistência.");
  const repository = {
    async revoke() { throw expectedError; },
  } as Pick<IRefreshTokenRepository, "revoke"> as IRefreshTokenRepository;
  const service = new AuthService(repository, { now: () => revokedAt }, { hash: async () => "", matches: async () => false }, { hash: async () => "", compare: async () => false }, { findCredentialsByIdentifier: async () => null, findActiveUserById: async () => null, findActivePasswordResetRecipient: async () => null, findActivePasswordResetRecipientById: async () => null, findInactiveAccountReactivationRecipient: async () => null, reactivateUserById: async () => false, changePasswordHash: async () => undefined }, { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } }, { generate: () => "" }, {} as PrismaClient);

  await assert.rejects(service.logout({ sessionId: "session-1" }), error => error === expectedError);
});
