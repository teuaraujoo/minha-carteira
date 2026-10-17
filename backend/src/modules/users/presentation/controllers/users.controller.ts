import type { Request, Response } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { UserService } from "../../application/services/users.service.js";
import { uploadProfileImageSchema } from "../schemas/users.schemas.js";

export class UserController {
    constructor(
        private readonly userService: UserService,
    ) { }

    async uploadProfileImage(request: Request, response: Response): Promise<void> {
        if (!request.file) {
            throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Imagem de perfil obrigatória." });
        }

        const parsed = uploadProfileImageSchema.safeParse({
            ...request.body,
            image: {
                content: request.file.buffer,
                contentType: request.file.mimetype,
                size: request.file.size,
            },
        });
        if (!parsed.success) {
            throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Dados da imagem de perfil inválidos.", cause: parsed.error });
        }

        const result = await this.userService.uploadProfileImage(parsed.data);
        sendSuccess(response, result);
    };
}
