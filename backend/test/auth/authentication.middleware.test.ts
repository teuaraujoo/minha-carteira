import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createAuthenticationMiddleware } from "../../src/modules/auth/presentation/middlewares/authentication.middleware.js";
import type {
  JwtProvider,
  VerifiedToken,
} from "../../src/modules/auth/application/contracts/auth.contracts.js";
import type { RefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { RefreshToken, type RefreshTokenProps } from "../../src/modules/auth/domain/entities/auth.entities.js";
import type { UsersAuthGateway } from "../../src/modules/users/index.js";
import { UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const now = new Date("2026-01-02T00:00:00.000Z");
const verifiedAccess: VerifiedToken = {
  userId: "user-1", sessionId: "session-1", tokenId: "access-1", type: "access",
  issuedAt: new Date("2026-01-02T00:00:00.000Z"),
  expiresAt: new Date("2026-01-02T00:15:00.000Z"),
};

function session(overrides: Partial<RefreshTokenProps> = {}): RefreshToken {
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");
  return new RefreshToken({
    id: "session-1", userId: "user-1", tokenHash: "hash", issuedAt,
    expiresAt: new Date("2026-01-06T00:00:00.000Z"), lastUsedAt: null,
    revokedAt: null, userAgent: null, ipAddress: null, revokeReason: null,
    createdAt: issuedAt, updatedAt: issuedAt, ...overrides,
  });
}

function setup(options: {
  token?: string;
  verified?: VerifiedToken;
  verifyError?: Error;
  currentSession?: RefreshToken | null;
  activeUser?: "ACTIVE" | "INACTIVE" | null;
  resolveAccessToken?: (request: Request) => string | undefined;
} = {}) {
  const calls: string[] = [];
  const jwtProvider: JwtProvider = {
    async signAccessToken() { throw new Error("Não esperado."); },
    async signRefreshToken() { throw new Error("Não esperado."); },
    async verifyAccessToken(token) {
      calls.push("verifyAccessToken");
      assert.equal(token, options.token ?? "valid-access-token");
      if (options.verifyError) throw options.verifyError;
      return options.verified ?? verifiedAccess;
    },
    async verifyRefreshToken() { throw new Error("Não esperado."); },
  };
  const refreshTokenRepository: RefreshTokenRepository = {
    async save() { throw new Error("Não esperado."); },
    async findActiveById(id, at) {
      calls.push("findActiveById");
      assert.equal(id, "session-1");
      assert.equal(at.getTime(), now.getTime());
      return options.currentSession === undefined ? session() : options.currentSession;
    },
    async registerUse() { throw new Error("Não esperado."); },
    async revoke() { throw new Error("Não esperado."); },
    async revokeAllFromUser() { throw new Error("Não esperado."); },
  };
  const usersAuthGateway: UsersAuthGateway = {
    async findCredentialsByIdentifier() { throw new Error("Não esperado."); },
    async findActiveUserById(id) {
      calls.push("findActiveUserById");
      assert.equal(id, "user-1");
      if (options.activeUser === null) return null;
      return {
        id,
        role: UserRoles.USER,
        capabilities: [],
        status: options.activeUser === "INACTIVE" ? UserStatus.INACTIVE : UserStatus.ACTIVE,
      };
    },
    async changePasswordHash() { throw new Error("Não esperado."); },
  };
  const clock: ClockProvider = { now: () => now };
  const middleware = createAuthenticationMiddleware({ jwtProvider, refreshTokenRepository, usersAuthGateway, clock },
    options.resolveAccessToken ?? (request => (request as Request & { suppliedAccessToken?: string }).suppliedAccessToken));
  const request = { suppliedAccessToken: options.token ?? "valid-access-token" } as Request & { suppliedAccessToken?: string };
  let receivedError: unknown;
  let nextCalls = 0;
  const next: NextFunction = error => {
    nextCalls += 1;
    receivedError = error;
  };

  return {
    middleware,
    request,
    next,
    response: {} as Response,
    calls,
    get receivedError() { return receivedError; },
    get nextCalls() { return nextCalls; },
  };
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof AppError && error.status === 401
    && error.code === ErrorCode.UNAUTHORIZED
    && error.message === "Autenticação inválida ou expirada.";
}

test("instala contexto autenticado após validar access, sessão e usuário", async () => {
  const fixture = setup();
  await fixture.middleware(fixture.request, fixture.response, fixture.next);

  assert.deepEqual(fixture.request.auth, { userId: "user-1", sessionId: "session-1" });
  assert.equal(fixture.receivedError, undefined);
  assert.equal(fixture.nextCalls, 1);
  assert.deepEqual(fixture.calls, ["verifyAccessToken", "findActiveById", "findActiveUserById"]);
});

test("rejeita token ausente, inválido ou do tipo refresh", async () => {
  const missing = setup({ token: " " });
  missing.request.suppliedAccessToken = " ";
  await missing.middleware(missing.request, missing.response, missing.next);
  assert.ok(isUnauthorized(missing.receivedError));
  assert.deepEqual(missing.calls, []);

  const invalid = setup({ verifyError: new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Token inválido." }) });
  await invalid.middleware(invalid.request, invalid.response, invalid.next);
  assert.ok(invalid.receivedError instanceof AppError);

  const wrongType = setup({ verified: { ...verifiedAccess, type: "refresh" } });
  await wrongType.middleware(wrongType.request, wrongType.response, wrongType.next);
  assert.ok(isUnauthorized(wrongType.receivedError));
});

test("rejeita sessão ausente, expirada, revogada ou pertencente a outro usuário", async () => {
  const missing = setup({ currentSession: null });
  await missing.middleware(missing.request, missing.response, missing.next);
  assert.ok(isUnauthorized(missing.receivedError));

  const expired = setup({ currentSession: null });
  await expired.middleware(expired.request, expired.response, expired.next);
  assert.ok(isUnauthorized(expired.receivedError));

  const revoked = setup({ currentSession: null });
  await revoked.middleware(revoked.request, revoked.response, revoked.next);
  assert.ok(isUnauthorized(revoked.receivedError));

  const wrongOwner = setup({ currentSession: session({ userId: "user-2" }) });
  await wrongOwner.middleware(wrongOwner.request, wrongOwner.response, wrongOwner.next);
  assert.ok(isUnauthorized(wrongOwner.receivedError));
});

test("rejeita usuário inativo ou removido", async () => {
  for (const activeUser of ["INACTIVE", null] as const) {
    const fixture = setup({ activeUser });
    await fixture.middleware(fixture.request, fixture.response, fixture.next);
    assert.ok(isUnauthorized(fixture.receivedError));
  }
});

test("libera uma rota Express protegida de teste com o contexto autenticado", async () => {
  const fixture = setup({
    resolveAccessToken: request => request.get("authorization")?.replace(/^Bearer\s+/i, ""),
  });
  const app = express();
  app.get("/protected-test", fixture.middleware, (request, response) => {
    response.status(200).json(request.auth);
  });
  type TestRouteLayer = { route?: { path: string; stack: Array<{ handle: (request: Request, response: Response, next: NextFunction) => unknown }> } };
  const layers = (app as unknown as { router: { stack: TestRouteLayer[] } }).router.stack;
  const route = layers.find(layer => layer.route?.path === "/protected-test")?.route;
  assert.ok(route);
  assert.equal(route.stack.length, 2);

  const request = {
    get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer valid-access-token" : undefined,
  } as Request;
  let statusCode: number | undefined;
  let responseBody: unknown;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; return this; },
  } as unknown as Response;
  let nextError: unknown;
  await route.stack[0]!.handle(request, response, error => { nextError = error; });
  assert.equal(nextError, undefined);
  await route.stack[1]!.handle(request, response, () => undefined);

  assert.equal(statusCode, 200);
  assert.deepEqual(responseBody, { userId: "user-1", sessionId: "session-1" });
});
