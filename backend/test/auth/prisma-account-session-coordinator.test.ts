import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { RefreshToken } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { PrismaAccountSessionCoordinator } from "../../src/modules/auth/infrastructure/repositories/prisma-account-session-coordinator.js";

const at = new Date("2026-10-18T12:00:00.000Z");

function setup(initialStatus = "ACTIVE") {
  const calls: Array<{ method: string; input?: unknown }> = [];
  let status = initialStatus;
  const transaction = {
    $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ method: "lock-account", input: { query: query.join("?"), values } });
      return status ? [{ status }] : [];
    },
    user: {
      updateMany: async (input: unknown) => {
        calls.push({ method: "update-user", input });
        const data = (input as { data: { status: string } }).data;
        status = data.status;
        return { count: 1 };
      },
    },
    refreshToken: {
      create: async (input: unknown) => { calls.push({ method: "create-session", input }); return {}; },
      updateMany: async (input: unknown) => { calls.push({ method: "revoke-sessions", input }); return { count: 2 }; },
    },
    challenge: {
      updateMany: async (input: unknown) => { calls.push({ method: "invalidate-challenges", input }); return { count: 2 }; },
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => operation(transaction),
  } as unknown as PrismaClient;

  return { coordinator: new PrismaAccountSessionCoordinator(prisma), calls };
}

function session() {
  return new RefreshToken({
    id: "session-1",
    userId: "123e4567-e89b-42d3-a456-426614174000",
    tokenHash: "hash",
    issuedAt: at,
    expiresAt: new Date(at.getTime() + 60_000),
    lastUsedAt: null,
    revokedAt: null,
    userAgent: null,
    ipAddress: null,
    revokeReason: null,
    createdAt: at,
    updatedAt: at,
  });
}

test("bloqueia a conta antes de gravar sessão e não grava se estiver inativa", async () => {
  const active = setup("ACTIVE");
  assert.equal(await active.coordinator.createSessionIfAccountActive(session()), true);
  assert.deepEqual(active.calls.map(({ method }) => method), ["lock-account", "create-session"]);
  assert.match((active.calls[0]?.input as { query: string }).query, /FOR UPDATE/);

  const inactive = setup("INACTIVE");
  assert.equal(await inactive.coordinator.createSessionIfAccountActive(session()), false);
  assert.deepEqual(inactive.calls.map(({ method }) => method), ["lock-account"]);
});

test("desativa a conta e revoga sessões na mesma transação depois do bloqueio", async () => {
  const fixture = setup("ACTIVE");

  assert.equal(await fixture.coordinator.deactivateAccountAndRevokeSessions(session().userId, at), true);
  assert.deepEqual(fixture.calls.map(({ method }) => method), ["lock-account", "update-user", "revoke-sessions"]);
});

test("reativa a conta, revoga sessões e invalida todos os links pendentes na mesma transação", async () => {
  const fixture = setup("INACTIVE");

  assert.deepEqual(
    await fixture.coordinator.reactivateAccountAndRevokeSessions(session().userId, at),
    { found: true, reactivated: true },
  );
  assert.deepEqual(fixture.calls.map(({ method }) => method), [
    "lock-account",
    "update-user",
    "revoke-sessions",
    "invalidate-challenges",
  ]);
  const challengeUpdate = fixture.calls.find(({ method }) => method === "invalidate-challenges")?.input as {
    where: { purpose: string; subjectType: string; status: string };
    data: { status: string };
  };
  assert.deepEqual(challengeUpdate.where, {
    purpose: "ACCOUNT_REACTIVATION",
    subjectType: "USER",
    subjectId: session().userId,
    status: "REQUESTED",
  });
  assert.equal(challengeUpdate.data.status, "FAILED");
});

test("invalidade links pendentes inclusive quando a conta já está ativa", async () => {
  const fixture = setup("ACTIVE");

  assert.deepEqual(
    await fixture.coordinator.reactivateAccountAndRevokeSessions(session().userId, at),
    { found: true, reactivated: false },
  );
  assert.deepEqual(fixture.calls.map(({ method }) => method), ["lock-account", "invalidate-challenges"]);
});
