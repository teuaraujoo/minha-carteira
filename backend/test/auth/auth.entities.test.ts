import assert from "node:assert/strict";
import test from "node:test";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { PasswordResetRequest } from "../../src/modules/auth/domain/entities/password-reset-request.entity.js";
import { RefreshToken } from "../../src/modules/auth/domain/entities/refresh-token.entity.js";
import type { ChallengeProps, PasswordResetRequestProps, RefreshTokenProps } from "../../src/modules/auth/domain/interfaces/auth.interfaces.js";
import {
  ChallengePurpose,
  ChallengeStatus,
  ChallengeSubjectType,
  PasswordResetRequestStatus,
  RefreshTokenRevokeReason,
} from "../../src/modules/auth/domain/enums/auth.enums.js";

const start = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-02T00:00:00.000Z");
const metadata = { location: null, userAgent: null, ipAddress: null, deviceId: null };

function refreshToken(overrides: Partial<RefreshTokenProps> = {}): RefreshToken {
  return new RefreshToken({ id: "session-1", userId: "user-1", tokenHash: "hash", issuedAt: start,
    expiresAt: later, lastUsedAt: null, revokedAt: null, userAgent: null, ipAddress: null,
    revokeReason: null, createdAt: start, updatedAt: start, ...overrides });
}

function resetRequest(overrides: Partial<PasswordResetRequestProps> = {}): PasswordResetRequest {
  return new PasswordResetRequest({ id: "request-1", userId: "user-1", status: PasswordResetRequestStatus.PENDING,
    requestedAt: start, expiresAt: later, metadata, completedAt: null, cancelledAt: null,
    createdAt: start, updatedAt: start, ...overrides });
}

function challenge(overrides: Partial<ChallengeProps> = {}): Challenge {
  return new Challenge({ id: "challenge-1", purpose: ChallengePurpose.PASSWORD_RESET,
    subjectType: ChallengeSubjectType.PASSWORD_RESET_REQUEST, subjectId: "request-1", secretHash: "secret-hash",
    status: ChallengeStatus.REQUESTED, attempts: 0, maxAttempts: 3,
    metadata: { issued: metadata, consumed: null }, expiresAt: later, consumedAt: null,
    createdAt: start, updatedAt: start, ...overrides });
}

test("identifica sessão ativa e encerra validade na expiração ou revogação", () => {
  assert.equal(refreshToken().isActiveAt(start), true);
  assert.equal(refreshToken().isActiveAt(later), false);
  assert.equal(refreshToken({ revokedAt: start, revokeReason: RefreshTokenRevokeReason.LOGOUT }).isActiveAt(start), false);
  assert.throws(() => refreshToken({ revokedAt: start }), /Data e motivo/);
});

test("representa estados e expiração de solicitação de recuperação", () => {
  const pending = resetRequest();
  assert.equal(pending.isPendingAt(start), true);
  assert.equal(pending.isPendingAt(later), false);
  assert.equal(resetRequest({ status: PasswordResetRequestStatus.COMPLETED, completedAt: later }).isPendingAt(start), false);
  assert.throws(() => resetRequest({ status: PasswordResetRequestStatus.COMPLETED }), /completedAt/);
  assert.throws(() => resetRequest({ expiresAt: start }), /posterior/);
});

test("representa validade, tentativas e consumo do desafio", () => {
  assert.equal(challenge().isUsableAt(start), true);
  assert.equal(challenge().isUsableAt(later), false);
  assert.equal(challenge({ attempts: 3 }).isUsableAt(start), false);
  assert.equal(challenge({ status: ChallengeStatus.COMPLETED, consumedAt: later }).isUsableAt(start), false);
  assert.throws(() => challenge({ status: ChallengeStatus.COMPLETED }), /consumedAt/);
  assert.throws(() => challenge({ attempts: 4 }), /maxAttempts/);
});

test("copia metadata e datas para impedir mutações externas", () => {
  const source = { ...metadata, location: { latitude: 1, longitude: 2 } };
  const request = resetRequest({ metadata: source });
  source.location.latitude = 9;
  assert.equal(request.metadata.location?.latitude, 1);
  const date = request.requestedAt;
  date.setTime(0);
  assert.equal(request.requestedAt.getTime(), start.getTime());
});
