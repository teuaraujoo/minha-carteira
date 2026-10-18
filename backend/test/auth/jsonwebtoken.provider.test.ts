import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { JsonWebTokenProvider } from "../../src/modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const TEST_SECRET = "segredo-exclusivo-dos-testes-auth";
const subject = { userId: "user-1", sessionId: "session-1" };

function assertUnauthorized(error: unknown): boolean {
  return error instanceof AppError && error.status === 401 && error.code === ErrorCode.UNAUTHORIZED
    && error.message === "Token inválido ou expirado.";
}

test("emite access e refresh com claims, algoritmo e prazos definidos", async () => {
  const provider = new JsonWebTokenProvider(TEST_SECRET);
  const accessToken = await provider.signAccessToken(subject);
  const refreshToken = await provider.signRefreshToken(subject);
  const access = await provider.verifyAccessToken(accessToken);
  const refresh = await provider.verifyRefreshToken(refreshToken);

  assert.equal(access.userId, subject.userId);
  assert.equal(access.sessionId, subject.sessionId);
  assert.equal(access.type, "access");
  assert.ok(access.tokenId.length > 0);
  assert.equal(access.expiresAt.getTime() - access.issuedAt.getTime(), 15 * 60 * 1000);
  assert.equal(refresh.type, "refresh");
  assert.equal(refresh.expiresAt.getTime() - refresh.issuedAt.getTime(), 5 * 24 * 60 * 60 * 1000);
});

test("lê JWT_SECRET do ambiente sem carregar arquivo .env", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
  try {
    const provider = new JsonWebTokenProvider();
    assert.equal((await provider.verifyAccessToken(await provider.signAccessToken(subject))).userId, subject.userId);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("rejeita token de tipo trocado, assinatura, expiração, claims e algoritmo", async () => {
  const provider = new JsonWebTokenProvider(TEST_SECRET);
  const accessToken = await provider.signAccessToken(subject);
  const refreshToken = await provider.signRefreshToken(subject);
  const invalidClaims = jwt.sign({ sid: subject.sessionId, type: "access" }, TEST_SECRET, {
    algorithm: "HS256", subject: subject.userId, expiresIn: 900,
  });
  const wrongAlgorithm = jwt.sign({ sid: subject.sessionId, type: "access" }, TEST_SECRET, {
    algorithm: "HS384", subject: subject.userId, jwtid: "token-1", expiresIn: 900,
  });
  const expired = jwt.sign({ sid: subject.sessionId, type: "access" }, TEST_SECRET, {
    algorithm: "HS256", subject: subject.userId, jwtid: "token-2", expiresIn: -1,
  });
  const invalidType = jwt.sign({ sid: subject.sessionId, type: "other" }, TEST_SECRET, {
    algorithm: "HS256", subject: subject.userId, jwtid: "token-3", expiresIn: 900,
  });

  await assert.rejects(provider.verifyAccessToken(refreshToken), assertUnauthorized);
  await assert.rejects(provider.verifyRefreshToken(accessToken), assertUnauthorized);
  await assert.rejects(provider.verifyAccessToken(`${accessToken.slice(0, -1)}x`), assertUnauthorized);
  await assert.rejects(provider.verifyAccessToken(expired), assertUnauthorized);
  await assert.rejects(provider.verifyAccessToken(wrongAlgorithm), assertUnauthorized);
  await assert.rejects(provider.verifyAccessToken(invalidClaims), assertUnauthorized);
  await assert.rejects(provider.verifyAccessToken(invalidType), assertUnauthorized);
});

test("exige segredo de configuração não vazio", () => {
  assert.throws(() => new JsonWebTokenProvider(" "), /JWT_SECRET é obrigatória/);
});
