import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGE_FLOW_POLICIES } from "../../src/modules/auth/domain/constants/challenge-policies.js";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType } from "../../src/modules/auth/domain/enums/auth.enums.js";
import type { ChallengeMetadata, RequestMetadata } from "../../src/modules/auth/domain/interfaces/auth.interfaces.js";

const now = new Date("2026-11-15T12:00:00.000Z");
const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
const requestMetadata: RequestMetadata = {
  location: null,
  userAgent: "Navegador",
  ipAddress: "127.0.0.1",
  deviceId: "device-1",
};
const baseMetadata: ChallengeMetadata = {
  issued: requestMetadata,
  consumed: null,
};

test("CHALLENGE_FLOW_POLICIES cobre todas as finalidades declaradas", () => {
  for (const purpose of Object.values(ChallengePurpose)) {
    const policy = CHALLENGE_FLOW_POLICIES[purpose];
    assert.equal(policy.purpose, purpose);
    assert.ok(policy.allowedSubjectTypes.length >= 1);
    assert.ok(policy.codeTtlMs > 0);
    assert.ok(policy.maxAttempts >= 1);
  }
  assert.deepEqual(CHALLENGE_FLOW_POLICIES[ChallengePurpose.EMAIL_VERIFICATION].allowedSubjectTypes, [ChallengeSubjectType.EMAIL]);
  assert.equal(CHALLENGE_FLOW_POLICIES[ChallengePurpose.EMAIL_VERIFICATION].requiresTargetEmail, true);
  assert.equal(CHALLENGE_FLOW_POLICIES[ChallengePurpose.EMAIL_VERIFICATION].requiresSubjectId, false);
});

test("Challenge EMAIL_VERIFICATION aceita targetEmail sem subjectId e preserva nextAttemptAt e tokenPayload", () => {
  const nextAttemptAt = new Date(now.getTime() + 45 * 1000);
  const metadata: ChallengeMetadata = {
    issued: requestMetadata,
    consumed: requestMetadata,
    tokenPayload: {
      sub: "novo@example.com",
      iss: "minha-carteira-api",
      jti: "jti-1",
      iat: 1700000000,
      exp: 1700000900,
      type: "onboarding",
      cid: "challenge-1",
    },
  };

  const challenge = new Challenge({
    id: "challenge-1",
    purpose: ChallengePurpose.EMAIL_VERIFICATION,
    subjectType: ChallengeSubjectType.EMAIL,
    subjectId: null,
    targetEmail: " NOVO@EXAMPLE.COM ",
    secretHash: "hash-1",
    status: ChallengeStatus.COMPLETED,
    attempts: 0,
    maxAttempts: 3,
    nextAttemptAt,
    metadata,
    expiresAt,
    consumedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(challenge.subjectId, null);
  assert.equal(challenge.targetEmail, "novo@example.com");
  assert.equal(challenge.nextAttemptAt?.getTime(), nextAttemptAt.getTime());
  assert.equal(challenge.isResendAllowedAt(new Date(nextAttemptAt.getTime() - 1)), false);
  assert.equal(challenge.isResendAllowedAt(nextAttemptAt), true);
  assert.deepEqual(challenge.metadata.tokenPayload, metadata.tokenPayload);
});

test("Challenge rejeita combinações inválidas entre finalidade, tipo de sujeito, subjectId e targetEmail", () => {
  assert.throws(() => new Challenge({
    id: "c1",
    purpose: ChallengePurpose.EMAIL_VERIFICATION,
    subjectType: ChallengeSubjectType.USER,
    subjectId: "user-1",
    targetEmail: null,
    secretHash: "h1",
    status: ChallengeStatus.REQUESTED,
    attempts: 0,
    maxAttempts: 3,
    metadata: baseMetadata,
    expiresAt,
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
  }), /Tipo do sujeito incompatível/);

  assert.throws(() => new Challenge({
    id: "c2",
    purpose: ChallengePurpose.EMAIL_VERIFICATION,
    subjectType: ChallengeSubjectType.EMAIL,
    subjectId: "user-1",
    targetEmail: "a@example.com",
    secretHash: "h2",
    status: ChallengeStatus.REQUESTED,
    attempts: 0,
    maxAttempts: 3,
    metadata: baseMetadata,
    expiresAt,
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
  }), /deve ser nulo/);

  assert.throws(() => new Challenge({
    id: "c3",
    purpose: ChallengePurpose.PASSWORD_RESET,
    subjectType: ChallengeSubjectType.USER,
    subjectId: "user-1",
    targetEmail: "a@example.com",
    secretHash: "h3",
    status: ChallengeStatus.REQUESTED,
    attempts: 0,
    maxAttempts: 3,
    metadata: baseMetadata,
    expiresAt,
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
  }), /e-mail alvo do desafio deve ser nulo/);
});
