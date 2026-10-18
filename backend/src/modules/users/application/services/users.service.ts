import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { UploadProfileImageInput, UploadProfileImageResult } from "../@types/users.types.js";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { StorageContextType } from "../../../storage/domain/enums/storage.enums.js";
import type { StorageOperations } from "../../../storage/domain/interfaces/storage.interfaces.js";


export class UserService {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly storageProvider: StorageOperations,
        private readonly logger: AppLogger,
    ) { }

    async uploadProfileImage(input: UploadProfileImageInput): Promise<UploadProfileImageResult> {
        const profile = await this.userRepository.findActiveUser(input.userId);

        if (!profile) throw new UserNotFoundError();

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
}
