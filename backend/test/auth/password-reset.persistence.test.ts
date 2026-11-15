import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType } from "../../src/modules/auth/domain/enums/auth.enums.js";
import { PrismaChallengeRepository } from "../../src/modules/auth/infrastructure/repositories/challenge.repository.js";

const at = new Date("2026-10-18T12:00:00.000Z");
const metadata = { location: { latitude: -3.7, longitude: -38.5 }, userAgent: "Teste", ipAddress: "127.0.0.1", deviceId: null };

function makeChallenge(): Challenge {
  return new Challenge({
    id: "challenge-id", purpose: ChallengePurpose.PASSWORD_RESET,
    subjectType: ChallengeSubjectType.USER, subjectId: "user-id",
    secretHash: "hashed-secret", status: ChallengeStatus.REQUESTED, attempts: 0,
    maxAttempts: 3, metadata: { issued: metadata, consumed: null },
    expiresAt: new Date(at.getTime() + 15 * 60 * 1000), consumedAt: null,
    createdAt: at, updatedAt: at,
  });
}

function makeAccountReactivationChallenge(): Challenge {
  return new Challenge({
    id: "challenge-id", purpose: ChallengePurpose.ACCOUNT_REACTIVATION,
    subjectType: ChallengeSubjectType.USER, subjectId: "user-id",
    secretHash: "hashed-secret", status: ChallengeStatus.REQUESTED, attempts: 0,
    maxAttempts: 3, metadata: { issued: metadata, consumed: null },
    expiresAt: new Date(at.getTime() + 15 * 60 * 1000), consumedAt: null,
    createdAt: at, updatedAt: at,
  });
}

test("repository persiste metadata como JSON e somente o hash do desafio", async () => {
  let challengeData: Record<string, unknown> | undefined;
  const fake = {
    challenge: { create: async ({ data }: { data: Record<string, unknown> }) => { challengeData = data; } },
  } as unknown as Pick<PrismaClient, "challenge">;
  await new PrismaChallengeRepository(fake).save(makeChallenge());

  assert.deepEqual(challengeData?.metadata, { issued: metadata, consumed: null });
  assert.equal(challengeData?.secretHash, "hashed-secret");
  assert.equal(JSON.stringify(challengeData).includes("secret-token"), false);
});

test("terceira tentativa inválida marca o desafio como FAILED por atualização condicional", async () => {
  const calls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const fake = {
    challenge: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        calls.push({ where, data });
        return { count: 1 };
      },
      findUnique: async () => ({ attempts: 3, maxAttempts: 3 }),
    },
  } as unknown as Pick<PrismaClient, "challenge">;
  const result = await new PrismaChallengeRepository(fake).registerInvalidAttempt("challenge-id", at);
  assert.equal(result, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]?.where.attempts, { lt: 3 });
  assert.deepEqual(calls[0]?.data.attempts, { increment: 1 });
  assert.equal(calls[1]?.data.status, "FAILED");
});

test("tentativas inválidas de reativação limitam-se ao desafio USER correspondente", async () => {
  const calls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const fake = {
    challenge: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { calls.push({ where, data }); return { count: 1 }; },
      findUnique: async () => ({ attempts: 3, maxAttempts: 3 }),
    },
  } as unknown as Pick<PrismaClient, "challenge">;
  const repository = new PrismaChallengeRepository(fake);
  const challenge = makeAccountReactivationChallenge();

  await repository.registerInvalidAttemptForPurpose(
    challenge.id,
    ChallengePurpose.ACCOUNT_REACTIVATION,
    ChallengeSubjectType.USER,
    challenge.maxAttempts,
    at,
  );

  assert.equal(calls[0]?.where.purpose, ChallengePurpose.ACCOUNT_REACTIVATION);
  assert.equal(calls[0]?.where.subjectType, ChallengeSubjectType.USER);
  assert.deepEqual(calls[0]?.where.attempts, { lt: 3 });
});

test("consumo condicional conclui o link de reativação uma única vez", async () => {
  let updateWhere: Record<string, unknown> | undefined;
  let updateData: Record<string, unknown> | undefined;
  const fake = {
    challenge: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateWhere = where;
        updateData = data;
        return { count: 1 };
      },
    },
  } as unknown as Pick<PrismaClient, "challenge">;
  const repository = new PrismaChallengeRepository(fake);
  const challenge = makeAccountReactivationChallenge();
  const result = await repository.completeIfUsableForPurpose(
    challenge.id,
    ChallengePurpose.ACCOUNT_REACTIVATION,
    ChallengeSubjectType.USER,
    challenge.maxAttempts,
    { issued: metadata, consumed: metadata },
    at,
  );

  assert.equal(result, true);
  assert.equal(updateWhere?.purpose, ChallengePurpose.ACCOUNT_REACTIVATION);
  assert.equal(updateWhere?.subjectType, ChallengeSubjectType.USER);
  assert.equal(updateData?.status, ChallengeStatus.COMPLETED);
  assert.equal(updateData?.consumedAt, at);
});

test("repository consulta contagem, último desafio e invalidação por targetEmail para EMAIL_VERIFICATION", async () => {
  const queries: Array<{ kind: string; payload: Record<string, unknown> }> = [];
  const emailChallengeRecord = {
    id: "email-challenge-1",
    purpose: ChallengePurpose.EMAIL_VERIFICATION,
    subjectType: ChallengeSubjectType.EMAIL,
    subjectId: null,
    targetEmail: "mfa@example.com",
    secretHash: "hashed-otp",
    status: ChallengeStatus.REQUESTED,
    attempts: 0,
    maxAttempts: 3,
    nextAttemptAt: new Date(at.getTime() + 45_000),
    metadata: { issued: metadata, consumed: null },
    expiresAt: new Date(at.getTime() + 300_000),
    consumedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  const fake = {
    challenge: {
      findFirst: async (input: Record<string, unknown>) => {
        queries.push({ kind: "findFirst", payload: input });
        return emailChallengeRecord;
      },
      count: async (input: Record<string, unknown>) => {
        queries.push({ kind: "count", payload: input });
        return 2;
      },
      updateMany: async (input: Record<string, unknown>) => {
        queries.push({ kind: "updateMany", payload: input });
        return { count: 1 };
      },
    },
  } as unknown as Pick<PrismaClient, "challenge">;

  const repository = new PrismaChallengeRepository(fake);
  const latest = await repository.findLatestByPurposeAndEmail(ChallengePurpose.EMAIL_VERIFICATION, " MFA@EXAMPLE.COM ");
  const count = await repository.countByPurposeAndEmailSince(ChallengePurpose.EMAIL_VERIFICATION, " MFA@EXAMPLE.COM ", at);
  const invalidated = await repository.invalidateOpenByPurposeAndEmail(ChallengePurpose.EMAIL_VERIFICATION, " MFA@EXAMPLE.COM ", at);

  assert.equal(latest?.targetEmail, "mfa@example.com");
  assert.equal(latest?.subjectId, null);
  assert.equal(count, 2);
  assert.equal(invalidated, 1);
  assert.equal((queries[2]?.payload.data as Record<string, unknown>)?.status, ChallengeStatus.EXPIRED);
});
