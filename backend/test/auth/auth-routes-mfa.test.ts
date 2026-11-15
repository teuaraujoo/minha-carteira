import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createApp } from "../../src/app/app.js";
import type { JwtProvider, TokenHasher } from "../../src/modules/auth/application/contracts/auth.contracts.js";
import type { AuthService } from "../../src/modules/auth/application/services/auth.service.js";
import type { IRefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthRouter } from "../../src/modules/auth/presentation/routes/auth.routes.js";
import { AUTH_COOKIE_NAMES, AUTH_COOKIE_PATHS } from "../../src/modules/auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../src/modules/users/application/services/users.service.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";

const origin = "https://carteira.example";

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  authServiceOverrides: Partial<AuthService> = {},
): Promise<void> {
  const authService = {
    login: async () => { throw new Error("Não esperado."); },
    refresh: async () => { throw new Error("Não esperado."); },
    logout: async () => undefined,
    requestPasswordReset: async () => undefined,
    confirmPasswordReset: async () => undefined,
    requestAccountReactivation: async () => undefined,
    confirmAccountReactivation: async () => undefined,
    requestMfa: async () => ({
      sent: true as const,
      challengeId: "11111111-1111-4111-8111-111111111111",
      nextAttemptAt: new Date("2026-11-15T12:00:45.000Z"),
    }),
    validateMfa: async () => ({
      accessToken: "onboarding-jwt",
      isRegistered: false,
    }),
    ...authServiceOverrides,
  } as unknown as AuthService;

  const tokenHasher: TokenHasher = {
    hash: async () => "hash",
    matches: async () => false,
  };
  const jwtProvider: JwtProvider = {
    signAccessToken: async () => "access",
    signRefreshToken: async () => "refresh",
    signOnboardingToken: async () => "onboarding",
    verifyAccessToken: async () => { throw new Error("Não esperado."); },
    verifyRefreshToken: async () => { throw new Error("Não esperado."); },
    verifyOnboardingToken: async () => { throw new Error("Não esperado."); },
  };
  const refreshTokenRepository: IRefreshTokenRepository = {
    save: async () => undefined,
    findActiveById: async () => null,
    registerUse: async () => undefined,
    revoke: async () => undefined,
    revokeAllFromUser: async () => undefined,
  };
  const userService = {} as UserService;

  const authRouter = createAuthRouter(
    authService,
    tokenHasher,
    jwtProvider,
    userService,
    refreshTokenRepository,
    [origin],
  );
  const app = createApp({
    logger: noopLogger,
    authRouter,
    usersRouter: Router(),
    allowedOrigins: [origin],
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}/api/v1/auth`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function issueCsrf(baseUrl: string): Promise<{ cookie: string; token: string }> {
  const response = await fetch(`${baseUrl}/csrf`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  const token = (await response.json() as { data: { token: string } }).data.token;
  return { cookie: `${AUTH_COOKIE_NAMES.csrf}=${token}`, token };
}

test("POST /request-mfa exige CSRF, coleta metadata da requisição e retorna sent, challengeId e nextAttemptAt", async () => {
  let receivedInput: unknown;
  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/request-mfa`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "teco@example.com" }),
    });
    assert.equal(unauthorized.status, 403);

    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/request-mfa`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
        "User-Agent": "NavegadorTeste/1.0",
      },
      body: JSON.stringify({
        email: " TECO@EXAMPLE.COM ",
        metadata: { deviceId: "device-web-1" },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { sent: boolean; challengeId: string; nextAttemptAt: string } };
    assert.deepEqual(body.data, {
      sent: true,
      challengeId: "11111111-1111-4111-8111-111111111111",
      nextAttemptAt: "2026-11-15T12:00:45.000Z",
    });
    assert.deepEqual(receivedInput, {
      email: "teco@example.com",
      metadata: {
        location: null,
        deviceId: "device-web-1",
        userAgent: "NavegadorTeste/1.0",
        ipAddress: "::ffff:127.0.0.1",
      },
    });
  }, {
    requestMfa: async (input) => {
      receivedInput = input;
      return {
        sent: true,
        challengeId: "11111111-1111-4111-8111-111111111111",
        nextAttemptAt: new Date("2026-11-15T12:00:45.000Z"),
      };
    },
  });
});

test("POST /validate-mfa define cookie __Secure-mc_onboarding para usuário novo sem definir cookies de sessão", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/validate-mfa`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
      },
      body: JSON.stringify({
        challengeId: "11111111-1111-4111-8111-111111111111",
        code: "123456",
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { accessToken: string; isRegistered: boolean } };
    assert.deepEqual(body.data, { accessToken: "onboarding-jwt", isRegistered: false });

    const cookies = response.headers.get("set-cookie") ?? "";
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.onboarding}=onboarding-jwt`));
    assert.ok(cookies.includes(`Path=${AUTH_COOKIE_PATHS.onboarding}`));
    assert.equal(cookies.includes(`${AUTH_COOKIE_NAMES.access}=`), false);
    assert.equal(cookies.includes(`${AUTH_COOKIE_NAMES.refresh}=`), false);
  });
});

test("POST /validate-mfa define cookies access/refresh, limpa onboarding e não vaza refreshToken no JSON para usuário existente", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/validate-mfa`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
      },
      body: JSON.stringify({
        challengeId: "11111111-1111-4111-8111-111111111111",
        code: "654321",
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { accessToken: string; isRegistered: boolean } };
    assert.deepEqual(body.data, { accessToken: "session-access-jwt", isRegistered: true });
    assert.equal(JSON.stringify(body).includes("session-refresh-jwt"), false);

    const cookies = response.headers.get("set-cookie") ?? "";
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.access}=session-access-jwt`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.refresh}=session-refresh-jwt`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.onboarding}=;`));
  }, {
    validateMfa: async () => ({
      accessToken: "session-access-jwt",
      refreshToken: "session-refresh-jwt",
      isRegistered: true,
    }),
  });
});

test("POST /validate-mfa rejeita payload inválido com 400", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/validate-mfa`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
      },
      body: JSON.stringify({
        challengeId: "nao-eh-uuid",
        code: "12a456",
      }),
    });
    assert.equal(response.status, 400);
  });
});
