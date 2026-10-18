import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { AuthUser, RegisterUserInput, UsersAuthGateway, UsersRegistrationGateway } from "../../src/modules/users/index.js";
import { UserStatus, UserRoles } from "../../src/modules/users/domain/enums/users.enums.js";
import type { JwtProvider, RefreshTokenRepository, TokenHasher, VerifiedToken } from "../../src/modules/auth/application/contracts/auth.contracts.js";
import { RefreshToken, ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { createAuthRouter, type AuthRoutesDependencies } from "../../src/modules/auth/presentation/routes/auth.routes.js";
import { AUTH_COOKIE_NAMES, AUTH_COOKIE_PATHS } from "../../src/modules/auth/presentation/security/auth-cookies.js";
import { createApp } from "../../src/app/app.js";

const origin = "https://carteira.example";
const now = new Date("2026-10-17T12:00:00.000Z");

async function withServer(run: (baseUrl: string) => Promise<void>, overrides: Partial<AuthRoutesDependencies> = {}): Promise<void> {
  const dependencies = createDependencies(overrides);
  const app = createApp({ authRouter: createAuthRouter(dependencies), allowedOrigins: [origin] });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}/api/v1/auth`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createDependencies(overrides: Partial<AuthRoutesDependencies> = {}): AuthRoutesDependencies {
  const user: AuthUser = {
    id: "user-1",
    role: UserRoles.USER,
    capabilities: [],
    status: UserStatus.ACTIVE,
  };
  const session = new RefreshToken({
    id: "session-1",
    userId: user.id,
    tokenHash: "hash",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    lastUsedAt: null,
    revokedAt: null,
    userAgent: null,
    ipAddress: null,
    revokeReason: null,
    createdAt: now,
    updatedAt: now,
  });
  const jwtProvider: JwtProvider = {
    signAccessToken: async () => "access-next",
    signRefreshToken: async () => "refresh-new",
    verifyAccessToken: async () => verified("access"),
    verifyRefreshToken: async () => verified("refresh"),
  };
  const refreshTokenRepository: RefreshTokenRepository = {
    save: async () => undefined,
    findActiveById: async () => session,
    registerUse: async () => undefined,
    revoke: async () => undefined,
    revokeAllFromUser: async () => undefined,
  };
  const usersAuthGateway: UsersAuthGateway = {
    findCredentialsByIdentifier: async () => ({ id: user.id, passwordHash: "password-hash", status: UserStatus.ACTIVE }),
    findActiveUserById: async () => user,
    changePasswordHash: async () => undefined,
  };
  const usersRegistrationGateway: UsersRegistrationGateway = {
    registerUser: async (input: RegisterUserInput) => ({
      id: "new-user",
      username: input.username,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: UserRoles.USER,
      capabilities: [],
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      inactivatedAt: null,
    }),
  };
  const tokenHasher: TokenHasher = {
    hash: async () => "hash",
    matches: async (token, hash) => token === "refresh-token" && hash === "hash",
  };
  return {
    loginUseCase: { execute: async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" }) },
    refreshSessionUseCase: { execute: async () => ({ accessToken: "access-refreshed" }) },
    logoutSessionUseCase: { execute: async () => undefined },
    usersRegistrationGateway,
    jwtProvider,
    refreshTokenRepository,
    usersAuthGateway,
    tokenHasher,
    clock: { now: () => now },
    allowedOrigins: [origin],
    ...overrides,
  };
}

function verified(type: VerifiedToken["type"]): VerifiedToken {
  return {
    userId: "user-1",
    sessionId: "session-1",
    tokenId: "token-1",
    type,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
  };
}

async function issueCsrf(baseUrl: string): Promise<{ cookie: string; token: string }> {
  const response = await fetch(`${baseUrl}/csrf`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  const token = (await response.json() as { data: { token: string } }).data.token;
  const cookieHeader = response.headers.get("set-cookie");
  assert.ok(cookieHeader?.includes(`${AUTH_COOKIE_NAMES.csrf}=${token}`));
  assert.ok(cookieHeader?.includes("HttpOnly"));
  assert.ok(cookieHeader?.includes("Secure"));
  assert.ok(cookieHeader?.includes("SameSite=None"));
  assert.ok(cookieHeader?.includes(`Path=${AUTH_COOKIE_PATHS.csrf}`));
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(response.headers.get("pragma"), "no-cache");
  return { cookie: `${AUTH_COOKIE_NAMES.csrf}=${token}`, token };
}

test("GET /csrf define cookie seguro e retorna token para header", async () => {
  await withServer(async (baseUrl) => {
    const result = await issueCsrf(baseUrl);
    assert.equal(result.token.length, 43);
  });
});

test("login valida CSRF, define cookies de autenticação e não expõe tokens no JSON", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
      },
      body: JSON.stringify({ identifier: "teco", password: " senha " }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { user: AuthUser } };
    assert.equal(body.data.user.id, "user-1");
    assert.equal(JSON.stringify(body).includes("access-token"), false);
    assert.equal(JSON.stringify(body).includes("refresh-token"), false);
    const cookies = response.headers.get("set-cookie") ?? "";
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.access}=access-token`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.refresh}=refresh-token`));
    assert.ok(cookies.includes("HttpOnly"));
    assert.ok(cookies.includes("Secure"));
    assert.ok(cookies.includes("SameSite=None"));
    assert.ok(cookies.includes(`Path=${AUTH_COOKIE_PATHS.access}`));
    assert.ok(cookies.includes(`Path=${AUTH_COOKIE_PATHS.refresh}`));
  });
});

test("requisições mutáveis rejeitam origem não autorizada e token CSRF divergente", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const badOrigin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { Origin: "https://malicioso.example", "Content-Type": "application/json", Cookie: csrf.cookie, "X-CSRF-Token": csrf.token },
      body: JSON.stringify({ identifier: "teco", password: "senha" }),
    });
    assert.equal(badOrigin.status, 403);

    const badToken = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", Cookie: csrf.cookie, "X-CSRF-Token": "outro-token" },
      body: JSON.stringify({ identifier: "teco", password: "senha" }),
    });
    assert.equal(badToken.status, 403);

    const missingOrigin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: csrf.cookie, "X-CSRF-Token": csrf.token },
      body: JSON.stringify({ identifier: "teco", password: "senha" }),
    });
    assert.equal(missingOrigin.status, 403);

    const missingCookie = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
      body: JSON.stringify({ identifier: "teco", password: "senha" }),
    });
    assert.equal(missingCookie.status, 403);
  });
});

test("refresh usa refresh cookie e devolve somente novo access cookie com 204", async () => {
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `${csrf.cookie}; ${AUTH_COOKIE_NAMES.refresh}=refresh-token`,
        "X-CSRF-Token": csrf.token,
      },
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.ok((response.headers.get("set-cookie") ?? "").includes(`${AUTH_COOKIE_NAMES.access}=access-refreshed`));
  });
});

test("/me retorna apenas contexto autenticado e logout limpa cookies", async () => {
  await withServer(async (baseUrl) => {
    const me = await fetch(`${baseUrl}/me`, { headers: { Cookie: `${AUTH_COOKIE_NAMES.access}=access-token` } });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json() as { data: unknown }).data, { userId: "user-1", sessionId: "session-1" });

    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `${csrf.cookie}; ${AUTH_COOKIE_NAMES.access}=access-token; ${AUTH_COOKIE_NAMES.refresh}=refresh-token`,
        "X-CSRF-Token": csrf.token,
      },
    });
    assert.equal(response.status, 204);
    const cookies = response.headers.get("set-cookie") ?? "";
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.access}=`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.refresh}=`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.csrf}=`));
    assert.ok(cookies.includes("HttpOnly"));
    assert.ok(cookies.includes("Secure"));
    assert.ok(cookies.includes("SameSite=None"));
  });
});

test("logout inválido ainda limpa cookies sem revogar uma sessão desconhecida", async () => {
  let revokedSessionId: string | null | undefined;
  const logoutSessionUseCase = { execute: async (input: { sessionId: string | null }) => { revokedSessionId = input.sessionId; } };
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
      },
    });
    assert.equal(response.status, 204);
    assert.equal(revokedSessionId, null);
    const cookies = response.headers.get("set-cookie") ?? "";
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.access}=`));
    assert.ok(cookies.includes(`${AUTH_COOKIE_NAMES.refresh}=`));
  }, { logoutSessionUseCase });
});

test("logout usa refresh válido quando o access token expirou", async () => {
  let revokedSessionId: string | null | undefined;
  const jwtProvider: JwtProvider = {
    signAccessToken: async () => "access-next",
    signRefreshToken: async () => "refresh-new",
    verifyAccessToken: async () => { throw new Error("Token expirado."); },
    verifyRefreshToken: async () => verified("refresh"),
  };
  const logoutSessionUseCase = { execute: async (input: { sessionId: string | null }) => { revokedSessionId = input.sessionId; } };
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `${csrf.cookie}; ${AUTH_COOKIE_NAMES.access}=expirado; ${AUTH_COOKIE_NAMES.refresh}=refresh-token`,
        "X-CSRF-Token": csrf.token,
      },
    });
    assert.equal(response.status, 204);
    assert.equal(revokedSessionId, "session-1");
  }, { jwtProvider, logoutSessionUseCase });
});

test("refresh e logout também bloqueiam operações sem CSRF", async () => {
  let refreshCalls = 0;
  let logoutCalls = 0;
  await withServer(async (baseUrl) => {
    const refresh = await fetch(`${baseUrl}/refresh`, {
      method: "POST",
      headers: { Origin: origin, Cookie: `${AUTH_COOKIE_NAMES.refresh}=refresh-token` },
    });
    const logout = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { Origin: origin, Cookie: `${AUTH_COOKIE_NAMES.access}=access-token` },
    });
    assert.equal(refresh.status, 403);
    assert.equal(logout.status, 403);
    assert.equal(refreshCalls, 0);
    assert.equal(logoutCalls, 0);
  }, {
    refreshSessionUseCase: { execute: async () => { refreshCalls += 1; return { accessToken: "access" }; } },
    logoutSessionUseCase: { execute: async () => { logoutCalls += 1; } },
  });
});

test("cadastro delega para users e não cria sessão", async () => {
  let received: RegisterUserInput | undefined;
  const usersRegistrationGateway: UsersRegistrationGateway = {
    registerUser: async (input) => {
      received = input;
      return {
        id: "new-user",
        username: input.username,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: UserRoles.USER,
        capabilities: [],
        status: UserStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        inactivatedAt: null,
      };
    },
  };
  await withServer(async (baseUrl) => {
    const csrf = await issueCsrf(baseUrl);
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", Cookie: csrf.cookie, "X-CSRF-Token": csrf.token },
      body: JSON.stringify({ username: "teco_user", name: "Teco Usuario", email: "teco@example.com", phone: "85999999999", password: "senha segura" }),
    });
    assert.equal(response.status, 201);
    assert.equal(received?.username, "teco_user");
    assert.equal(response.headers.get("set-cookie"), null);
  }, { usersRegistrationGateway });
});
