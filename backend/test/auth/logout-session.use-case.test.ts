import assert from "node:assert/strict";
import test from "node:test";
import { LogoutSessionUseCase } from "../../src/modules/auth/application/use-cases/logout-session.use-case.js";
import type { RefreshTokenRepository } from "../../src/modules/auth/application/contracts/auth.contracts.js";
import { RefreshTokenRevokeReason } from "../../src/modules/auth/domain/enums/auth.enums.js";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";

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
  } as RefreshTokenRepository;
  const clock: ClockProvider = { now: () => revokedAt };
  return {
    useCase: new LogoutSessionUseCase({ refreshTokenRepository: repository, clock }),
    calls,
    alreadyRevoked,
    get effectiveRevocations() { return effectiveRevocations; },
  };
}

test("revoga a sessão atual com motivo LOGOUT e data do clock", async () => {
  const fixture = setup();
  await fixture.useCase.execute({ sessionId: "session-1" });

  assert.deepEqual(fixture.calls, [{
    id: "session-1", at: revokedAt, reason: RefreshTokenRevokeReason.LOGOUT,
  }]);
  assert.equal(fixture.alreadyRevoked.has("session-1"), true);
  assert.equal(fixture.effectiveRevocations, 1);
});

test("logout repetido e sessão ausente permanecem idempotentes", async () => {
  const fixture = setup();
  await fixture.useCase.execute({ sessionId: "session-1" });
  await fixture.useCase.execute({ sessionId: "session-1" });
  await fixture.useCase.execute({ sessionId: null });
  await fixture.useCase.execute({ sessionId: " " });

  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.effectiveRevocations, 1);
});

test("propaga falhas de persistência para que a camada HTTP não confirme falso sucesso", async () => {
  const expectedError = new Error("Falha de persistência.");
  const repository = {
    async revoke() { throw expectedError; },
  } as Pick<RefreshTokenRepository, "revoke"> as RefreshTokenRepository;
  const useCase = new LogoutSessionUseCase({
    refreshTokenRepository: repository,
    clock: { now: () => revokedAt },
  });

  await assert.rejects(useCase.execute({ sessionId: "session-1" }), error => error === expectedError);
});
