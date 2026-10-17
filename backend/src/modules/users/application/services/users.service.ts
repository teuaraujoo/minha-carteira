import type { IStorageProvider } from "../../../../shared/domain/interfaces/storage.interface.js";
import { buildProfileImageKey } from "../../../../shared/application/storage/utils/storage.utils.js";
import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { UploadProfileImageInput, UploadProfileImageResult } from "../@types/users.types.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";


export class UserService {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly storageProvider: IStorageProvider,
        private readonly logger: AppLogger,
    ) { }

    async uploadProfileImage(input: UploadProfileImageInput): Promise<UploadProfileImageResult> {
        this.logger.info({
            event: "users.profile-image.uploaded",
            module: "users",
            message: "Iniciando armazenamento de imagem de perfil",
            context: { operation: "uploadProfileImage", userId: input.userId },
            date: new Date()
        });

        const profile = await this.userRepository.findActiveUser(input.userId);

        if (!profile) throw new AppError({ status: 400, code: ErrorCode.NOT_FOUND, message: "Usuário não encontrado." })

        const key = buildProfileImageKey(input.userId, input.image.contentType);

        await this.storageProvider.upload(key, input.image.content, input.image.contentType);

        this.logger.info({
            event: "users.profile-image.uploaded",
            module: "users",
            message: "Imagem de perfil armazenada com sucesso",
            context: { operation: "uploadProfileImage", userId: input.userId },
        });

        const url = await this.storageProvider.getPresignedUrl(key)
        return { url };
    }
}
