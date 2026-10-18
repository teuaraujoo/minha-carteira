import assert from "node:assert/strict";
import test from "node:test";
import { LoginUseCase } from "../../src/modules/auth/application/use-cases/login.use-case.js";
import { mapLoginOutput, type LoginInput } from "../../src/modules/auth/application/dto/login.dto.js";
import type {
  JwtProvider,
  RefreshTokenRepository,
  TokenHasher,
  TokenSubject,
} from "../../src/modules/auth/application/contracts/auth.contracts.js";
import { REFRESH_TOKEN_TTL_MS, type RefreshToken } from "../../src/modules/auth/domain/entities/auth.entities.js";
import type { AuthUser, AuthUserCredentials, UsersAuthGateway } from "../../src/modules/users/index.js";
import { UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";
import type { IdGenerator } from "../../src/shared/application/id-generator.js";
import type { PasswordHasher } from "../../src/shared/application/security/password-hasher.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";

const now = new Date("2026-01-02T03:04:05.000Z");
const rawPassword = "  senha com espaços  ";
const accessToken = "signed-access-token";
const refreshToken = "signed-refresh-token";
const tokenHash = "sha256-refresh-token-hash";
const activeUser: AuthUser = {
  id: "user-1", role: UserRoles.USER, capabilities: [], status: UserStatus.ACTIVE,
};
const activeCredentials: AuthUserCredentials = {
  id: "user-1", passwordHash: "bcrypt-password-hash", status: UserStatus.ACTIVE,
};

function setup(options: {
  credentials?: AuthUserCredentials | null;
  passwordMatches?: boolean;
  user?: AuthUser | null;
} = {}) {
  const calls: Array<{ method: string; input?: unknown }> = [];
  const savedSessions: RefreshToken[] = [];
  let generatedIds = 0;
  const usersAuthGateway: UsersAuthGateway = {
    async findCredentialsByIdentifier(identifier) {
      calls.push({ method: "findCredentialsByIdentifier", input: identifier });
      return options.credentials === undefined ? activeCredentials : options.credentials;
    },
    async findActiveUserById(userId) {
      calls.push({ method: "findActiveUserById", input: userId });
      return options.user === undefined ? activeUser : options.user;
    },
    async changePasswordHash() { throw new Error("Não esperado."); },
  };
  const passwordHasher: PasswordHasher = {
    async hash() { throw new Error("Não esperado."); },
    async compare(password, passwordHash) {
      calls.push({ method: "compare", input: { password, passwordHash } });
      assert.equal(password, rawPassword);
      assert.equal(passwordHash, "bcrypt-password-hash");
      return options.passwordMatches ?? true;
    },
  };
  const idGenerator: IdGenerator = {
    generate() {
      generatedIds += 1;
      return "session-1";
    },
  };
  const jwtProvider: JwtProvider = {
    async signAccessToken(subject: TokenSubject) {
      calls.push({ method: "signAccessToken", input: subject });
      return accessToken;
    },
    async signRefreshToken(subject: TokenSubject) {
      calls.push({ method: "signRefreshToken", input: subject });
      return refreshToken;
    },
    async verifyAccessToken() { throw new Error("Não esperado."); },
    async verifyRefreshToken() { throw new Error("Não esperado."); },
  };
  const tokenHasher: TokenHasher = {
    async hash(token) {
      calls.push({ method: "hash", input: token });
      assert.equal(token, refreshToken);
      return tokenHash;
    },
    async matches() { throw new Error("Não esperado."); },
  };
  const refreshTokenRepository: RefreshTokenRepository = {
    async save(session) {
      calls.push({ method: "save" });
      savedSessions.push(session);
    },
    async findActiveById() { throw new Error("Não esperado."); },
    async registerUse() { throw new Error("Não esperado."); },
    async revoke() { throw new Error("Não esperado."); },
    async revokeAllFromUser() { throw new Error("Não esperado."); },
  };
  const clock: ClockProvider = { now: () => now };
  return {
    useCase: new LoginUseCase({
      usersAuthGateway, passwordHasher, idGenerator, jwtProvider,
      tokenHasher, refreshTokenRepository, clock,
    }),
    calls,
    savedSessions,
    get generatedIds() { return generatedIds; },
  };
}

async function unauthorizedSnapshot(promise: Promise<unknown>): Promise<{ status: number; code: ErrorCode; message: string }> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AppError);
    return { status: error.status, code: error.code, message: error.message };
  }
  assert.fail("Era esperado que o login fosse rejeitado.");
}

test("autentica por e-mail normalizado e preserva a senha sem trim", async () => {
  const fixture = setup();
  const result = await fixture.useCase.execute({ identifier: "  ANA@EXAMPLE.COM  ", password: rawPassword });
  const session = fixture.savedSessions[0];

  assert.equal(fixture.calls[0]?.method, "findCredentialsByIdentifier");
  assert.equal(fixture.calls[0]?.input, "ana@example.com");
  assert.deepEqual(fixture.calls[1], {
    method: "compare",
    input: { password: rawPassword, passwordHash: activeCredentials.passwordHash },
  });
  assert.deepEqual(result, { user: activeUser, accessToken, refreshToken });
  assert.ok(session);
  assert.equal(session.id, "session-1");
  assert.equal(session.userId, "user-1");
  assert.equal(session.tokenHash, tokenHash);
  assert.equal(session.expiresAt.getTime() - now.getTime(), REFRESH_TOKEN_TTL_MS);
  assert.equal("token" in session, false);
  assert.equal(fixture.generatedIds, 1);

  const publicOutput = mapLoginOutput(result.user);
  assert.deepEqual(publicOutput, { user: activeUser });
  assert.equal(JSON.stringify(publicOutput).includes(accessToken), false);
  assert.equal(JSON.stringify(publicOutput).includes(refreshToken), false);
  assert.equal(JSON.stringify(publicOutput).includes(tokenHash), false);
});

test("autentica por username normalizado sem interpretar @", async () => {
  const fixture = setup();
  await fixture.useCase.execute({ identifier: "  MinhaConta  ", password: rawPassword });
  assert.equal(fixture.calls[0]?.input, "minhaconta");
});

test("usuário ausente, senha incorreta e usuário inativo têm o mesmo erro público", async () => {
  const missingUser = setup({ credentials: null });
  const wrongPassword = setup({ passwordMatches: false });
  const inactiveUser = setup({ credentials: { ...activeCredentials, status: UserStatus.INACTIVE } });
  const deactivatedDuringLogin = setup({ user: null });

  const errors = await Promise.all([
    unauthorizedSnapshot(missingUser.useCase.execute({ identifier: "unknown", password: rawPassword })),
    unauthorizedSnapshot(wrongPassword.useCase.execute({ identifier: "ana@example.com", password: rawPassword })),
    unauthorizedSnapshot(inactiveUser.useCase.execute({ identifier: "ana@example.com", password: rawPassword })),
    unauthorizedSnapshot(deactivatedDuringLogin.useCase.execute({ identifier: "ana@example.com", password: rawPassword })),
  ]);

  assert.deepEqual(errors, Array.from({ length: errors.length }, () => ({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Identificador ou senha inválidos.",
  })));
  assert.equal(missingUser.savedSessions.length, 0);
  assert.equal(wrongPassword.savedSessions.length, 0);
  assert.equal(inactiveUser.savedSessions.length, 0);
  assert.equal(deactivatedDuringLogin.savedSessions.length, 0);
  assert.equal(inactiveUser.calls.some(call => call.method === "compare"), true);
});

test("rejeita identificador vazio com a mesma resposta genérica", async () => {
  const fixture = setup();
  const error = await unauthorizedSnapshot(fixture.useCase.execute({ identifier: " ", password: rawPassword }));

  assert.deepEqual(error, {
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Identificador ou senha inválidos.",
  });
  assert.equal(fixture.calls.length, 0);
});
