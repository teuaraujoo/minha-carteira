import type { JwtProvider, PasswordResetRateLimiter, TokenGenerator, TokenHasher, LogoutSessionInput, RefreshSessionInput, RefreshSessionOutput } from "../contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";
import {
  ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
  ACCOUNT_REACTIVATION_TOKEN_TTL_MS,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../../domain/constants/auth.constants.js";
import { Challenge } from "../../domain/entities/challenge.entity.js";
import { RefreshToken } from "../../domain/entities/refresh-token.entity.js";
import type { ChallengeMetadata, RequestMetadata } from "../../domain/interfaces/auth.interfaces.js";
import type { LoginInput, LoginSessionResult } from "../dto/login.dto.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import type { EmailProvider } from "../../../../shared/application/contracts/email-provider.contract.js";
import type { IChallengeRepository } from "../../domain/interfaces/challenge-repository.interface.js";
import { ChallengePurpose, ChallengeStatus, ChallengeSubjectType } from "../../domain/enums/auth.enums.js";
import type { PrismaClient } from "../../../../../generated/prisma/client.js";
import { UserStatus as PrismaUserStatus } from "../../../../../generated/prisma/enums.js";
import { PrismaRefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository.js";
import { PrismaChallengeRepository } from "../../infrastructure/repositories/challenge.repository.js";
import { randomUUID } from "node:crypto";
import type { UserService } from "../../../users/application/services/users.service.js";

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

export interface AuthEmailDependencies {
  emailProvider: EmailProvider;
  tokenGenerator: TokenGenerator;
  rateLimiter: PasswordResetRateLimiter;
  frontendUrl: string;
  logger: AppLogger;
}

export class AuthService {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly passwordHasher: PasswordHasher,
    private readonly userService: UserService,
    private readonly jwtProvider: JwtProvider,
    private readonly prisma: PrismaClient,
    private readonly challengeRepository: IChallengeRepository,
    private readonly emailFlows?: AuthEmailDependencies,
  ) { }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    const dependencies = this.requireEmailFlows();
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const metadata = snapshotMetadata(input.metadata);
    if (!dependencies.rateLimiter.consume(normalizedEmail, metadata.ipAddress ?? "desconhecido", now)) return;

    const recipient = await this.userService.findActivePasswordResetRecipient(normalizedEmail);
    if (!recipient) return;

    const challengeId = randomUUID();
    const secret = dependencies.tokenGenerator.generate();
    const secretHash = await this.tokenHasher.hash(secret);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
    const challenge = new Challenge({
      id: challengeId,
      purpose: ChallengePurpose.PASSWORD_RESET,
      subjectType: ChallengeSubjectType.USER,
      subjectId: recipient.id,
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

    await this.challengeRepository.save(challenge);

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
        await this.challengeRepository.markFailed(challengeId, new Date());
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
    const dependencies = this.requireEmailFlows();
    if (input.password !== input.passwordConfirmation || input.password.length < 8) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "A senha e a confirmação devem corresponder e possuir pelo menos 8 caracteres." });
    }
    const [challengeId, secret, ...extra] = input.token.split(".");
    if (!challengeId || !secret || extra.length > 0) throw invalidResetToken();
    const now = new Date();
    const consumedMetadata: ChallengeMetadata = {
      issued: snapshotMetadata(input.metadata),
      consumed: snapshotMetadata(input.metadata),
    };

    const changedEmail = await this.prisma.$transaction(async (transaction) => {
      const challenges = new PrismaChallengeRepository(transaction);
      const refreshTokens = new PrismaRefreshTokenRepository(transaction);
      const challenge = await challenges.findById(challengeId);
      if (!challenge || challenge.purpose !== ChallengePurpose.PASSWORD_RESET
        || challenge.subjectType !== ChallengeSubjectType.USER
        || !challenge.isUsableAt(now)) return null;

      if (!await this.tokenHasher.matches(secret, challenge.secretHash)) {
        await challenges.registerInvalidAttempt(challengeId, now);
        return null;
      }

      const recipient = await transaction.user.findFirst({
        where: { id: challenge.subjectId, status: PrismaUserStatus.ACTIVE },
        select: { email: true },
      });
      if (!recipient) return null;

      if (!await challenges.completeIfUsable(challengeId, {
        issued: challenge.metadata.issued,
        consumed: consumedMetadata.consumed,
      }, now)) return null;

      const passwordHash = await this.passwordHasher.hash(input.password);
      const updatedUser = await transaction.user.updateMany({
        where: { id: challenge.subjectId, status: PrismaUserStatus.ACTIVE },
        data: { passwordHash, updatedAt: now },
      });
      if (updatedUser.count !== 1) throw invalidResetToken();
      await refreshTokens.revokeAllFromUser(
        challenge.subjectId,
        now,
        RefreshTokenRevokeReason.PASSWORD_RESET,
      );
      return recipient.email;
    });

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

  async requestAccountReactivation(input: RequestPasswordResetInput): Promise<void> {
    const dependencies = this.requireEmailFlows();
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const metadata = snapshotMetadata(input.metadata);
    if (!dependencies.rateLimiter.consume(normalizedEmail, metadata.ipAddress ?? "desconhecido", now)) return;

    const recipient = await this.userService.findInactiveAccountReactivationRecipient(normalizedEmail);
    if (!recipient) return;

    const challengeId = randomUUID();
    const secret = dependencies.tokenGenerator.generate();
    const secretHash = await this.tokenHasher.hash(secret);
    const expiresAt = new Date(now.getTime() + ACCOUNT_REACTIVATION_TOKEN_TTL_MS);
    const challenge = new Challenge({
      id: challengeId,
      purpose: ChallengePurpose.ACCOUNT_REACTIVATION,
      subjectType: ChallengeSubjectType.USER,
      subjectId: recipient.id,
      secretHash,
      status: ChallengeStatus.REQUESTED,
      attempts: 0,
      maxAttempts: ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
      metadata: { issued: metadata, consumed: null },
      expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.challengeRepository.save(challenge);

    const reactivationUrl = new URL("/reactivate-account", dependencies.frontendUrl);
    reactivationUrl.searchParams.set("token", `${challengeId}.${secret}`);
    try {
      await dependencies.emailProvider.sendAccountReactivation({ email: recipient.email, reactivationUrl: reactivationUrl.toString() });
      dependencies.logger.info({
        event: "auth.account-reactivation.requested",
        module: "auth",
        message: "Solicitação de reativação registrada",
        context: { operation: "requestAccountReactivation", userId: recipient.id },
      });
    } catch {
      try {
        const failedAt = new Date()
        await this.challengeRepository.markFailed(challengeId, failedAt);
      } catch {
        dependencies.logger.error({
          event: "auth.account-reactivation.email-failed",
          module: "auth",
          message: "Falha ao registrar a falha do envio de reativação",
          context: { operation: "requestAccountReactivation", userId: recipient.id },
        });
        return;
      }
      dependencies.logger.warn({
        event: "auth.account-reactivation.email-failed",
        module: "auth",
        message: "O serviço de e-mail não entregou o link de reativação",
        context: { operation: "requestAccountReactivation", userId: recipient.id },
      });
    }
  }

  async confirmAccountReactivation(input: { token: string; metadata: RequestMetadata }): Promise<void> {
    const dependencies = this.requireEmailFlows();
    const [challengeId, secret, ...extra] = input.token.split(".");
    if (!challengeId || !secret || extra.length > 0) throw invalidAccountReactivationToken();

    const now = new Date();
    const challenge = await this.challengeRepository.findById(challengeId);
    if (!challenge || challenge.purpose !== ChallengePurpose.ACCOUNT_REACTIVATION
      || challenge.subjectType !== ChallengeSubjectType.USER || !challenge.isUsableAt(now)) {
      throw invalidAccountReactivationToken();
    }

    if (!await this.tokenHasher.matches(secret, challenge.secretHash)) {
      await this.challengeRepository.registerInvalidAttemptForPurpose(
        challenge.id,
        ChallengePurpose.ACCOUNT_REACTIVATION,
        ChallengeSubjectType.USER,
        ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
        now,
      );
      throw invalidAccountReactivationToken();
    }

    const consumedMetadata: ChallengeMetadata = {
      issued: challenge.metadata.issued,
      consumed: snapshotMetadata(input.metadata),
    };
    if (!await this.challengeRepository.completeIfUsableForPurpose(
      challenge.id,
      ChallengePurpose.ACCOUNT_REACTIVATION,
      ChallengeSubjectType.USER,
      ACCOUNT_REACTIVATION_MAX_ATTEMPTS,
      consumedMetadata,
      now,
    )) {
      throw invalidAccountReactivationToken();
    }

    if (!await this.userService.reactivateUserById(challenge.subjectId)) {
      throw invalidAccountReactivationToken();
    }

    dependencies.logger.info({
      event: "auth.account-reactivation.completed",
      module: "auth",
      message: "Conta reativada pelo link de confirmação; o usuário deverá entrar novamente",
      context: { operation: "confirmAccountReactivation", userId: challenge.subjectId },
    });
  }

  private requireEmailFlows(): AuthEmailDependencies {
    if (!this.emailFlows) {
      throw new AppError({ status: 500, code: ErrorCode.INTERNAL_ERROR, message: "Os fluxos de e-mail de autenticação não estão configurados." });
    }
    return this.emailFlows;
  }

  async login(input: LoginInput): Promise<LoginSessionResult> {
    if (typeof input?.identifier !== "string" || !input.identifier.trim()
      || typeof input.password !== "string") {
      throw invalidCredentials();
    }

    const identifier = input.identifier.trim().toLowerCase();
    const credentials = await this.userService.findCredentialsByIdentifier(identifier);
    if (!credentials) throw invalidCredentials();

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      credentials.passwordHash,
    );
    if (!passwordMatches || credentials.status !== "ACTIVE") throw invalidCredentials();

    const user = await this.userService.findActiveUserById(credentials.id);
    if (!user || user.status !== "ACTIVE") throw invalidCredentials();

    const now = new Date();
    const sessionId = randomUUID();
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
    if (!await this.createSessionIfAccountActive(session)) {
      throw invalidCredentials();
    }

    return { user, accessToken, refreshToken };
  }

  async logout(input: LogoutSessionInput): Promise<void> {
    const sessionId = input?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) return;

    const revokedAt = new Date();
    await this.refreshTokenRepository.revoke(
      sessionId,
      revokedAt,
      RefreshTokenRevokeReason.LOGOUT,
    );
  }

  async refresh(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    if (typeof input?.refreshToken !== "string" || !input.refreshToken.trim()) {
      throw unauthorized();
    }

    const verified = await this.jwtProvider.verifyRefreshToken(input.refreshToken);
    if (verified.type !== "refresh") throw unauthorized();

    const now = new Date();
    const session = await this.refreshTokenRepository.findActiveById(verified.sessionId, now);
    if (!session || session.userId !== verified.userId
      || !await this.tokenHasher.matches(input.refreshToken, session.tokenHash)) {
      throw unauthorized();
    }

    const user = await this.userService.findActiveUserById(verified.userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized();

    const accessToken = await this.jwtProvider.signAccessToken({
      userId: verified.userId,
      sessionId: verified.sessionId,
    });
    await this.refreshTokenRepository.registerUse(session.id, now);

    return { accessToken };
  }

  private createSessionIfAccountActive(session: RefreshToken): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const [account] = await transaction.$queryRaw<Array<{ status: string }>>`
        SELECT status::text AS status
        FROM users
        WHERE id = ${session.userId}::uuid
        FOR UPDATE
      `;
      if (!account || account.status !== "ACTIVE") return false;

      await new PrismaRefreshTokenRepository(transaction).save(session);
      return true;
    });
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

function invalidAccountReactivationToken(): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message: "Link de reativação inválido ou expirado.",
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
