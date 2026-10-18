import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { Challenge, PasswordResetRequest } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType, PasswordResetRequestStatus } from "../../src/modules/auth/domain/enums/auth.enums.js";
import { PrismaChallengeRepository } from "../../src/modules/auth/infrastructure/repositories/challenge.repository.js";
import { PrismaPasswordResetRequestRepository } from "../../src/modules/auth/infrastructure/repositories/password-reset-request.repository.js";

const at = new Date("2026-10-18T12:00:00.000Z");
const metadata = { location: { latitude: -3.7, longitude: -38.5 }, userAgent: "Teste", ipAddress: "127.0.0.1", deviceId: null };

function makeRequest(): PasswordResetRequest {
  return new PasswordResetRequest({
    id: "request-id", userId: "user-id", status: PasswordResetRequestStatus.PENDING,
    requestedAt: at, expiresAt: new Date(at.getTime() + 15 * 60 * 1000), metadata,
    completedAt: null, cancelledAt: null, createdAt: at, updatedAt: at,
  });
}

function makeChallenge(): Challenge {
  return new Challenge({
    id: "challenge-id", purpose: ChallengePurpose.PASSWORD_RESET,
    subjectType: ChallengeSubjectType.PASSWORD_RESET_REQUEST, subjectId: "request-id",
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
  let requestData: Record<string, unknown> | undefined;
  let challengeData: Record<string, unknown> | undefined;
  const fake = {
    passwordResetRequest: { create: async ({ data }: { data: Record<string, unknown> }) => { requestData = data; } },
    challenge: { create: async ({ data }: { data: Record<string, unknown> }) => { challengeData = data; } },
  } as unknown as Pick<PrismaClient, "passwordResetRequest" | "challenge">;
  await new PrismaPasswordResetRequestRepository(fake).save(makeRequest());
  await new PrismaChallengeRepository(fake).save(makeChallenge());

  assert.deepEqual(requestData?.metadata, metadata);
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

test("exclusão de solicitação remove desafios vinculados antes do registro pai", async () => {
  const calls: string[] = [];
  const fake = {
    challenge: { deleteMany: async ({ where }: { where: { subjectId: string } }) => { calls.push(`desafios:${where.subjectId}`); } },
    passwordResetRequest: { delete: async ({ where }: { where: { id: string } }) => { calls.push(`solicitacao:${where.id}`); } },
  } as unknown as Pick<PrismaClient, "passwordResetRequest" | "challenge">;
  await new PrismaPasswordResetRequestRepository(fake).deleteWithChallenges("request-id");
  assert.deepEqual(calls, ["desafios:request-id", "solicitacao:request-id"]);
});
