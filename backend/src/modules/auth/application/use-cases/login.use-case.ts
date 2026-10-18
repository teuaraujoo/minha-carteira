import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { IdGenerator } from "../../../../shared/application/id-generator.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import { REFRESH_TOKEN_TTL_MS, RefreshToken } from "../../domain/entities/auth.entities.js";
import type {
  JwtProvider,
  RefreshTokenRepository,
  TokenHasher,
} from "../contracts/auth.contracts.js";
import type { LoginInput, LoginSessionResult } from "../dto/login.dto.js";

export interface LoginDependencies {
  usersAuthGateway: UsersAuthGateway;
  passwordHasher: PasswordHasher;
  idGenerator: IdGenerator;
  jwtProvider: JwtProvider;
  tokenHasher: TokenHasher;
  refreshTokenRepository: RefreshTokenRepository;
  clock: ClockProvider;
}

export class LoginUseCase {
  constructor(private readonly dependencies: LoginDependencies) {}

  async execute(input: LoginInput): Promise<LoginSessionResult> {
    if (typeof input?.identifier !== "string" || !input.identifier.trim()
      || typeof input.password !== "string") {
      throw invalidCredentials();
    }

    const identifier = input.identifier.trim().toLowerCase();
    const credentials = await this.dependencies.usersAuthGateway.findCredentialsByIdentifier(identifier);
    if (!credentials) throw invalidCredentials();

    const passwordMatches = await this.dependencies.passwordHasher.compare(
      input.password,
      credentials.passwordHash,
    );
    if (!passwordMatches || credentials.status !== "ACTIVE") throw invalidCredentials();

    const user = await this.dependencies.usersAuthGateway.findActiveUserById(credentials.id);
    if (!user || user.status !== "ACTIVE") throw invalidCredentials();

    const now = this.dependencies.clock.now();
    const sessionId = this.dependencies.idGenerator.generate();
    const tokenSubject = { userId: credentials.id, sessionId };
    const [accessToken, refreshToken] = await Promise.all([
      this.dependencies.jwtProvider.signAccessToken(tokenSubject),
      this.dependencies.jwtProvider.signRefreshToken(tokenSubject),
    ]);
    const tokenHash = await this.dependencies.tokenHasher.hash(refreshToken);
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
    await this.dependencies.refreshTokenRepository.save(session);

    return { user, accessToken, refreshToken };
  }
}

function invalidCredentials(): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Identificador ou senha inválidos.",
  });
}
