import assert from "node:assert/strict";
import test from "node:test";
import { RefreshSessionUseCase } from "../../src/modules/auth/application/use-cases/refresh-session.use-case.js";
import type {
  JwtProvider,
  RefreshTokenRepository,
  TokenHasher,
  VerifiedToken,
} from "../../src/modules/auth/application/contracts/auth.contracts.js";
import { RefreshToken, type RefreshTokenProps } from "../../src/modules/auth/domain/entities/auth.entities.js";
import type { UsersAuthGateway } from "../../src/modules/users/index.js";
import { UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import { Sha256TokenHasher } from "../../src/modules/auth/infrastructure/security/sha256-token.hasher.js";

const now = new Date("2026-01-02T00:00:00.000Z");
const rawRefreshToken = "signed-refresh-token";
const verifiedRefresh: VerifiedToken = {
  userId: "user-1", sessionId: "session-1", tokenId: "token-1", type: "refresh",
  issuedAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2026-01-06T00:00:00.000Z"),
};

function session(overrides: Partial<RefreshTokenProps> = {}): RefreshToken {
  return new RefreshToken({
    id: "session-1", userId: "user-1", tokenHash: "stored-hash",
    issuedAt: verifiedRefresh.issuedAt, expiresAt: verifiedRefresh.expiresAt,
    lastUsedAt: null, revokedAt: null, userAgent: null, ipAddress: null,
    revokeReason: null, createdAt: verifiedRefresh.issuedAt, updatedAt: verifiedRefresh.issuedAt,
    ...overrides,
  });
}

function setup(options: {
  verified?: VerifiedToken;
  currentSession?: RefreshToken | null;
  hashMatches?: boolean;
  activeUser?: { id: string; status: "ACTIVE" | "INACTIVE" } | null;
  verifyError?: Error;
} = {}) {
  const calls: string[] = [];
  let registeredUse: { id: string; at: Date } | undefined;
  const jwtProvider: JwtProvider = {
    async signAccessToken(input) {
      calls.push("signAccessToken");
      assert.deepEqual(input, { userId: "user-1", sessionId: "session-1" });
      return "new-access-token";
    },
    async signRefreshToken() { throw new Error("O refresh token não deve ser rotacionado."); },
    async verifyAccessToken() { throw new Error("Não esperado."); },
    async verifyRefreshToken(token) {
      calls.push("verifyRefreshToken");
      assert.equal(token, rawRefreshToken);
      if (options.verifyError) throw options.verifyError;
      return options.verified ?? verifiedRefresh;
    },
  };
  const refreshTokenRepository: RefreshTokenRepository = {
    async save() { throw new Error("Não esperado."); },
    async findActiveById(id, at) {
      calls.push("findActiveById");
      assert.equal(id, "session-1");
      assert.equal(at.getTime(), now.getTime());
      return options.currentSession === undefined ? session() : options.currentSession;
    },
    async registerUse(id, at) {
      calls.push("registerUse");
      registeredUse = { id, at };
    },
    async revoke() { throw new Error("Não esperado."); },
    async revokeAllFromUser() { throw new Error("Não esperado."); },
  };
  const usersAuthGateway: UsersAuthGateway = {
    async findCredentialsByIdentifier() { throw new Error("Não esperado."); },
    async findActiveUserById(id) {
      calls.push("findActiveUserById");
      assert.equal(id, "user-1");
      return options.activeUser === undefined
        ? { id: "user-1", role: UserRoles.USER, capabilities: [], status: UserStatus.ACTIVE }
        : options.activeUser === null ? null : {
          id: options.activeUser.id,
          role: UserRoles.USER,
          capabilities: [],
          status: options.activeUser.status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.INACTIVE,
        };
    },
    async changePasswordHash() { throw new Error("Não esperado."); },
  };
  const tokenHasher: TokenHasher = {
    async hash() { return "stored-hash"; },
    async matches(token, expectedHash) {
      calls.push("matches");
      assert.equal(token, rawRefreshToken);
      assert.equal(expectedHash, "stored-hash");
      return options.hashMatches ?? true;
    },
  };
  const clock: ClockProvider = { now: () => now };
  return {
    useCase: new RefreshSessionUseCase({ jwtProvider, refreshTokenRepository, usersAuthGateway, tokenHasher, clock }),
    calls,
    get registeredUse() { return registeredUse; },
  };
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof AppError && error.status === 401
    && error.code === ErrorCode.UNAUTHORIZED && error.message === "Token inválido ou expirado.";
}

test("emite access token, registra uso e mantém refresh sem rotação", async () => {
  const fixture = setup();
  const result = await fixture.useCase.execute({ refreshToken: rawRefreshToken });

  assert.deepEqual(result, { accessToken: "new-access-token" });
  assert.deepEqual(fixture.calls, ["verifyRefreshToken", "findActiveById", "matches", "findActiveUserById", "signAccessToken", "registerUse"]);
  assert.deepEqual(fixture.registeredUse, { id: "session-1", at: now });
  assert.equal("refreshToken" in result, false);
});

test("rejeita sessão ausente, dono divergente, hash divergente e usuário inativo", async () => {
  await assert.rejects(setup({ currentSession: null }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
  await assert.rejects(setup({ currentSession: session({ userId: "user-2" }) }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
  await assert.rejects(setup({ hashMatches: false }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
  await assert.rejects(setup({ activeUser: null }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
  await assert.rejects(setup({ activeUser: { id: "user-1", status: "INACTIVE" } }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
});

test("rejeita token de tipo divergente e entrada vazia", async () => {
  await assert.rejects(setup({ verified: { ...verifiedRefresh, type: "access" } }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
  await assert.rejects(setup().useCase.execute({ refreshToken: " " }), isUnauthorized);
});

test("traduz token expirado ou inválido para erro genérico de autenticação", async () => {
  await assert.rejects(setup({ verifyError: new AppError({
    status: 401, code: ErrorCode.UNAUTHORIZED, message: "Token inválido ou expirado.",
  }) }).useCase.execute({ refreshToken: rawRefreshToken }), isUnauthorized);
});

test("hasheia tokens e compara hashes com formato validado", async () => {
  const hasher = new Sha256TokenHasher();
  const hash = await hasher.hash(rawRefreshToken);
  assert.equal(hash.length, 64);
  assert.equal(await hasher.matches(rawRefreshToken, hash), true);
  assert.equal(await hasher.matches("outro-token", hash), false);
  assert.equal(await hasher.matches(rawRefreshToken, "hash-inválido"), false);
});
