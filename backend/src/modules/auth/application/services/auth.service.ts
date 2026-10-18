import type { IdGenerator } from './../../../../shared/application/id-generator.js';
import type { JwtProvider, TokenHasher, LogoutSessionInput, RefreshSessionInput, RefreshSessionOutput } from '../contracts/auth.contracts.js';
import type { RefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";
import { REFRESH_TOKEN_TTL_MS, RefreshToken } from "../../domain/entities/auth.entities.js";
import type { LoginInput, LoginSessionResult } from "../dto/login.dto.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";

export class AuthService {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly clock: ClockProvider,
    private readonly tokenHasher: TokenHasher,
    private readonly passwordHasher: PasswordHasher,
    private readonly usersAuthGateway: UsersAuthGateway,
    private readonly jwtProvider: JwtProvider,
    private idGenerator: IdGenerator
  ) { }

  async login(input: LoginInput): Promise<LoginSessionResult> {
    if (typeof input?.identifier !== "string" || !input.identifier.trim()
      || typeof input.password !== "string") {
      throw invalidCredentials();
    }

    const identifier = input.identifier.trim().toLowerCase();
    const credentials = await this.usersAuthGateway.findCredentialsByIdentifier(identifier);
    if (!credentials) throw invalidCredentials();

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      credentials.passwordHash,
    );
    if (!passwordMatches || credentials.status !== "ACTIVE") throw invalidCredentials();

    const user = await this.usersAuthGateway.findActiveUserById(credentials.id);
    if (!user || user.status !== "ACTIVE") throw invalidCredentials();

    const now = this.clock.now();
    const sessionId = this.idGenerator.generate();
    const tokenSubject = { userId: credentials.id, sessionId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtProvider.signAccessToken(tokenSubject),
      this.jwtProvider.signRefreshToken(tokenSubject),
    ]);
    const tokenHash = await this.tokenHasher.hash(refreshToken);
    if (typeof tokenHash !== "string" || !tokenHash.trim()) {
      throw new TypeError("O hash do refresh token é obrigatório.");
    }

    const session = new RefreshToken({
      id: sessionId,
      userId: credentials.id,
      tokenHash,
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
    await this.refreshTokenRepository.save(session);

    return { user, accessToken, refreshToken };
  }

  async logout(input: LogoutSessionInput): Promise<void> {
    const sessionId = input?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) return;

    await this.refreshTokenRepository.revoke(
      sessionId,
      this.clock.now(),
      RefreshTokenRevokeReason.LOGOUT,
    );
  }

  async refresh(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    if (typeof input?.refreshToken !== "string" || !input.refreshToken.trim()) {
      throw unauthorized();
    }

    const verified = await this.jwtProvider.verifyRefreshToken(input.refreshToken);
    if (verified.type !== "refresh") throw unauthorized();

    const now = this.clock.now();
    const session = await this.refreshTokenRepository.findActiveById(verified.sessionId, now);
    if (!session || session.userId !== verified.userId
      || !await this.tokenHasher.matches(input.refreshToken, session.tokenHash)) {
      throw unauthorized();
    }

    const user = await this.usersAuthGateway.findActiveUserById(verified.userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized();

    const accessToken = await this.jwtProvider.signAccessToken({
      userId: verified.userId,
      sessionId: verified.sessionId,
    });
    await this.refreshTokenRepository.registerUse(session.id, now);

    return { accessToken };
  }

  async revokeAllFromUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllFromUser(
      userId,
      this.clock.now(),
      RefreshTokenRevokeReason.USER_DEACTIVATED,
    );
  }
}

function unauthorized(): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Token inválido ou expirado.",
  });
}

function invalidCredentials(): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "E-mail, nome de usuário ou senha inválidos.",
  });
}
