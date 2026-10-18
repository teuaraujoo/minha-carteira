import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { UploadProfileImageInput, UploadProfileImageResult, UpdateUserProfileInput, UserProfileOutput } from "../@types/users.types.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { StorageContextType } from "../../../storage/domain/enums/storage.enums.js";
import type { StorageOperations } from "../../../storage/domain/interfaces/storage.interfaces.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import type { IdGenerator } from "../../../../shared/application/id-generator.js";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";
import { User } from "../../domain/entities/users.entity.js";
import { mapRegisterUserOutput } from "../mappers/register-user.mapper.js";
import type { AccountReactivationRecipient, AuthUser, AuthUserCredentials, PasswordResetRecipient } from "../../domain/interfaces/users.interfaces.js";
import { UserRoles, UserStatus } from "../../domain/enums/users.enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import {
  ChallengePurpose as PrismaChallengePurpose,
  ChallengeStatus as PrismaChallengeStatus,
  ChallengeSubjectType as PrismaChallengeSubjectType,
  UserStatus as PrismaUserStatus,
} from "../../../../../generated/prisma/enums.js";
import { RefreshTokenRevokeReason } from "../../../auth/domain/enums/auth.enums.js";
import { PrismaRefreshTokenRepository } from "../../../auth/infrastructure/repositories/refresh-token.repository.js";


export class UserService {
  constructor(
    private readonly userRepository: IUsersRepository,
    private readonly storageProvider: StorageOperations,
    private readonly logger: AppLogger,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: ClockProvider,
    private readonly prisma: PrismaClient,
  ) { }

  async deactivateMyAccount(userId: string): Promise<void> {
    const deactivatedAt = this.clock.now();
    const deactivated = await this.prisma.$transaction(async (transaction) => {
      const [account] = await this.lockAccount(transaction, userId);
      if (!account || account.status !== UserStatus.ACTIVE) return false;

      const updated = await transaction.user.updateMany({
        where: { id: userId, status: PrismaUserStatus.ACTIVE },
        data: { status: PrismaUserStatus.INACTIVE, inactivatedAt: deactivatedAt, updatedAt: deactivatedAt },
      });
      if (updated.count !== 1) return false;

      await new PrismaRefreshTokenRepository(transaction).revokeAllFromUser(
        userId,
        deactivatedAt,
        RefreshTokenRevokeReason.USER_DEACTIVATED,
      );
      return true;
    });
    if (!deactivated) {
      throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado ou já inativo." });
    }
    this.logger.info({
      event: "users.account.deactivated",
      module: "users",
      message: "Conta desativada e sessões revogadas",
      context: { operation: "deactivateMyAccount", userId },
    });
  }

  async reactivateUserById(userId: string): Promise<boolean> {
    const reactivatedAt = this.clock.now();
    const result = await this.prisma.$transaction(async (transaction) => {
      const [account] = await this.lockAccount(transaction, userId);
      if (!account) return { found: false, reactivated: false };

      const reactivated = account.status === UserStatus.INACTIVE;
      if (reactivated) {
        const updated = await transaction.user.updateMany({
          where: { id: userId, status: PrismaUserStatus.INACTIVE },
          data: { status: PrismaUserStatus.ACTIVE, inactivatedAt: null, updatedAt: reactivatedAt },
        });
        if (updated.count !== 1) return { found: false, reactivated: false };

        await new PrismaRefreshTokenRepository(transaction).revokeAllFromUser(
          userId,
          reactivatedAt,
          RefreshTokenRevokeReason.USER_DEACTIVATED,
        );
      }

      await transaction.challenge.updateMany({
        where: {
          purpose: PrismaChallengePurpose.ACCOUNT_REACTIVATION,
          subjectType: PrismaChallengeSubjectType.USER,
          subjectId: userId,
          status: PrismaChallengeStatus.REQUESTED,
        },
        data: { status: PrismaChallengeStatus.FAILED, updatedAt: reactivatedAt },
      });

      return { found: true, reactivated };
    });
    if (!result.found) return false;

    if (result.reactivated) {
      this.logger.info({
        event: "users.account.reactivated",
        module: "users",
        message: "Conta reativada; o usuário deverá entrar novamente",
        context: { operation: "reactivateUserById", userId },
      });
    }
    return true;
  }

  async reactivateUserAsAdmin(actorUserId: string, targetUserId: string): Promise<void> {
    const actor = await this.userRepository.findActiveById(actorUserId);
    if (!actor || actor.role !== UserRoles.ADMIN) {
      throw new AppError({ status: 403, code: ErrorCode.FORBIDDEN, message: "Apenas um administrador pode reativar esta conta." });
    }

    if (!await this.reactivateUserById(targetUserId)) {
      throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });
    }
  }

  async getMyProfile(userId: string): Promise<UserProfileOutput> {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });

    const profileImage = await this.storageProvider.getActiveFileUrl(StorageContextType.USER_PROFILE, userId);
    return { ...user.toJSON(), profileImage };
  }

  async updateMyProfile(input: UpdateUserProfileInput): Promise<UserProfileOutput> {
    const user = await this.userRepository.findActiveById(input.userId);
    if (!user) throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });

    user.updateProfile({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    }, this.clock.now());
    await this.userRepository.save(user);
    return this.getMyProfile(input.userId);
  }

  async uploadProfileImage(input: UploadProfileImageInput): Promise<UploadProfileImageResult> {
    const profile = await this.userRepository.findActiveById(input.userId);

    if (!profile) throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });

    const stored = await this.storageProvider.replaceFileContent({
      ownerUserId: input.userId,
      contextType: StorageContextType.USER_PROFILE,
      contextId: input.userId,
      mimeType: input.image.contentType,
      content: input.image.content,
    });

    this.logger.info({
      event: "users.profile-image.uploaded",
      module: "users",
      message: "Imagem de perfil armazenada com sucesso",
      context: { operation: "uploadProfileImage", userId: input.userId },
    });

    return { url: stored.url, expiresAt: stored.expiresAt };
  }

  async registerUser(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (await this.userRepository.findByEmail(email)) {
      throw new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "E-mail ou nome de usuário já está em uso." });
    }
    if (await this.userRepository.findByUsername(username)) {
      throw new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "E-mail ou nome de usuário já está em uso." });
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    if (typeof passwordHash !== "string" || !passwordHash.trim()) {
      throw new TypeError("O hash da senha é obrigatório.");
    }

    const user = User.create({
      id: this.idGenerator.generate(),
      username,
      name,
      email,
      phone: input.phone,
      passwordHash,
      createdAt: this.clock.now(),
    });

    await this.userRepository.save(user);

    return mapRegisterUserOutput(user);
  }

  async findCredentialsByIdentifier(identifier: string): Promise<AuthUserCredentials | null> {
    const user = await this.userRepository.findByIdentifier(identifier);
    if (!user) return null;
    return { id: user.id, passwordHash: user.passwordHash, status: user.status };
  }

  async findActiveUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      capabilities: user.capabilities,
      status: user.status,
    };
  }

  async findActivePasswordResetRecipient(email: string): Promise<PasswordResetRecipient | null> {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!user || !user.isActive()) return null;
    return { id: user.id, email: user.email };
  }

  async findActivePasswordResetRecipientById(userId: string): Promise<PasswordResetRecipient | null> {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async findInactiveAccountReactivationRecipient(email: string): Promise<AccountReactivationRecipient | null> {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!user || user.isActive()) return null;
    return { id: user.id, email: user.email };
  }

  async changePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });
    user.changePasswordHash(passwordHash, this.clock.now());
    await this.userRepository.save(user);
  }

  private lockAccount(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<Array<{ status: string }>> {
    return transaction.$queryRaw<Array<{ status: string }>>`
      SELECT status::text AS status
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
  }
}
