import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { UploadProfileImageInput, UploadProfileImageResult } from "../@types/users.types.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { StorageContextType } from "../../../storage/domain/enums/storage.enums.js";
import type { StorageOperations } from "../../../storage/domain/interfaces/storage.interfaces.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import type { IdGenerator } from "../../../../shared/application/id-generator.js";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";
import { User } from "../../domain/entities/users.entity.js";
import { mapRegisterUserOutput } from "../mappers/register-user.mapper.js";
import type { AuthUser, AuthUserCredentials } from "../../domain/interfaces/users.interfaces.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";


export class UserService {
  constructor(
    private readonly userRepository: IUsersRepository,
    private readonly storageProvider: StorageOperations,
    private readonly logger: AppLogger,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: ClockProvider,
  ) { }

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

  async changePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." });
    user.changePasswordHash(passwordHash, this.clock.now());
    await this.userRepository.save(user);
  }
}