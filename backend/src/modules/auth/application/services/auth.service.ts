import type { IdGenerator } from './../../../../shared/application/id-generator.js';
import type { JwtProvider, TokenHasher, LogoutSessionInput, RefreshSessionInput, RefreshSessionOutput } from '../contracts/auth.contracts.js';
import type { RefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";
import {
  Challenge,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  PasswordResetRequest,
  REFRESH_TOKEN_TTL_MS,
  RefreshToken,
  type ChallengeMetadata,
  type RequestMetadata,
} from "../../domain/entities/auth.entities.js";
import type { LoginInput, LoginSessionResult } from "../dto/login.dto.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import type { EmailProvider, PasswordResetRateLimiter, TokenGenerator } from "../contracts/auth.contracts.js";
import type { PasswordResetUnitOfWork } from "../contracts/password-reset-unit-of-work.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType, PasswordResetRequestStatus } from "../../domain/enums/auth.enums.js";

export interface RequestPasswordResetInput {
  email: string;
  metadata: RequestMetadata;
}

export interface ConfirmPasswordResetInput {
  token: string;
  password: string;
  passwordConfirmation: string;
  metadata: RequestMetadata;
}

export interface PasswordResetDependencies {
  unitOfWork: PasswordResetUnitOfWork;
  emailProvider: EmailProvider;
  tokenGenerator: TokenGenerator;
  rateLimiter: PasswordResetRateLimiter;
  frontendUrl: string;
  logger: AppLogger;
}

class PasswordResetConcurrencyError extends Error { }

export class AuthService {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly clock: ClockProvider,
    private readonly tokenHasher: TokenHasher,
    private readonly passwordHasher: PasswordHasher,
    private readonly usersAuthGateway: UsersAuthGateway,
    private readonly jwtProvider: JwtProvider,
    private idGenerator: IdGenerator,
    private readonly passwordReset?: PasswordResetDependencies,
  ) { }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    const dependencies = this.requirePasswordReset();
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = this.clock.now();
    const metadata = snapshotMetadata(input.metadata);
    if (!dependencies.rateLimiter.consume(normalizedEmail, metadata.ipAddress ?? "desconhecido", now)) return;

    const recipient = await this.usersAuthGateway.findActivePasswordResetRecipient(normalizedEmail);
    if (!recipient) return;

    const requestId = this.idGenerator.generate();
    const challengeId = this.idGenerator.generate();
    const secret = dependencies.tokenGenerator.generate();
    const secretHash = await this.tokenHasher.hash(secret);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
    const resetRequest = new PasswordResetRequest({
      id: requestId,
      userId: recipient.id,
      status: PasswordResetRequestStatus.PENDING,
      requestedAt: now,
      expiresAt,
      metadata,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const challenge = new Challenge({
      id: challengeId,
      purpose: ChallengePurpose.PASSWORD_RESET,
      subjectType: ChallengeSubjectType.PASSWORD_RESET_REQUEST,
      subjectId: requestId,
      secretHash,
      status: ChallengeStatus.REQUESTED,
      attempts: 0,
      maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
      metadata: { issued: metadata, consumed: null },
      expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await dependencies.unitOfWork.execute(async (transaction) => {
      await transaction.requests.save(resetRequest);
      await transaction.challenges.save(challenge);
    });

    const resetUrl = new URL("/reset-password", dependencies.frontendUrl);
    resetUrl.searchParams.set("token", `${challengeId}.${secret}`);
    try {
      await dependencies.emailProvider.sendPasswordReset({ email: recipient.email, resetUrl: resetUrl.toString() });
      dependencies.logger.info({
        event: "auth.password-reset.requested",
        module: "auth",
        message: "Solicitação de redefinição de senha registrada",
        context: { operation: "requestPasswordReset", userId: recipient.id },
      });
    } catch {
      try {
        await dependencies.unitOfWork.execute(async (transaction) => {
          await transaction.requests.markFailed(requestId, this.clock.now());
          await transaction.challenges.markFailed(challengeId, this.clock.now());
        });
      } catch {
        dependencies.logger.error({
          event: "auth.password-reset.email-failed",
          module: "auth",
          message: "Falha ao registrar o estado de falha do envio de recuperação",
          context: { operation: "requestPasswordReset", userId: recipient.id },
        });
        return;
      }
      dependencies.logger.warn({
        event: "auth.password-reset.email-failed",
        module: "auth",
        message: "O serviço de e-mail não entregou o link de recuperação",
        context: { operation: "requestPasswordReset", userId: recipient.id },
      });
    }
  }

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    const dependencies = this.requirePasswordReset();
    if (input.password !== input.passwordConfirmation || input.password.length < 8) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "A senha e a confirmação devem corresponder e possuir pelo menos 8 caracteres." });
    }
    const [challengeId, secret, ...extra] = input.token.split(".");
    if (!challengeId || !secret || extra.length > 0) throw invalidResetToken();
    const now = this.clock.now();
    const consumedMetadata: ChallengeMetadata = {
      issued: snapshotMetadata(input.metadata),
      consumed: snapshotMetadata(input.metadata),
    };

    let changedEmail: string | null = null;
    try {
      changedEmail = await dependencies.unitOfWork.execute(async (transaction) => {
        const challenge = await transaction.challenges.findById(challengeId);
        if (!challenge || challenge.purpose !== ChallengePurpose.PASSWORD_RESET
          || challenge.subjectType !== ChallengeSubjectType.PASSWORD_RESET_REQUEST
          || !challenge.isUsableAt(now)) return null;

        if (!await this.tokenHasher.matches(secret, challenge.secretHash)) {
          await transaction.challenges.registerInvalidAttempt(challengeId, now);
          return null;
        }

        const resetRequest = await transaction.requests.findById(challenge.subjectId);
        if (!resetRequest || resetRequest.userId.length === 0 || !resetRequest.isPendingAt(now)) return null;
        const recipient = await transaction.users.findActivePasswordResetRecipientById(resetRequest.userId);
        if (!recipient) return null;

        if (!await transaction.challenges.completeIfUsable(challengeId, {
          issued: challenge.metadata.issued,
          consumed: consumedMetadata.consumed,
        }, now)) return null;
        if (!await transaction.requests.complete(resetRequest.id, now)) throw new PasswordResetConcurrencyError();

        const passwordHash = await this.passwordHasher.hash(input.password);
        await transaction.users.changePasswordHash(resetRequest.userId, passwordHash);
        await transaction.refreshTokens.revokeAllFromUser(
          resetRequest.userId,
          now,
          RefreshTokenRevokeReason.PASSWORD_RESET,
        );
        return recipient.email;
      });
    } catch (error) {
      if (error instanceof PasswordResetConcurrencyError) throw invalidResetToken();
      throw error;
    }

    if (!changedEmail) throw invalidResetToken();
    dependencies.logger.info({
      event: "auth.password-reset.completed",
      module: "auth",
      message: "Senha redefinida e sessões anteriores revogadas",
      context: { operation: "confirmPasswordReset" },
    });
    try {
      await dependencies.emailProvider.sendPasswordChanged({ email: changedEmail });
    } catch {
      dependencies.logger.warn({
        event: "auth.password-reset.notification-failed",
        module: "auth",
        message: "Não foi possível enviar a notificação de alteração de senha",
        context: { operation: "confirmPasswordReset" },
      });
    }
  }

  private requirePasswordReset(): PasswordResetDependencies {
    if (!this.passwordReset) {
      throw new AppError({ status: 500, code: ErrorCode.INTERNAL_ERROR, message: "A recuperação de senha não está configurada." });
    }
    return this.passwordReset;
  }

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

function invalidResetToken(): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message: "Token de recuperação inválido ou expirado.",
  });
}

function snapshotMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    location: metadata.location === null ? null : { ...metadata.location },
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
    deviceId: metadata.deviceId,
  };
}
