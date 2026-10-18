import type { Request, Response } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { UserService } from "../../application/services/users.service.js";
import { updateUserProfileSchema, uploadProfileImageSchema } from "../schemas/users.schemas.js";

type AuthenticatedRequest = Request & {
  auth?: { userId: string; sessionId: string };
};

export class UserController {
  constructor(
    private readonly userService: UserService,
  ) { }

  async getMyProfile(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    sendSuccess(response, await this.userService.getMyProfile(userId));
  }

  async updateMyProfile(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const parsed = updateUserProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Dados do perfil inválidos.", cause: parsed.error });
    }
    sendSuccess(response, await this.userService.updateMyProfile({
      userId,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
    }));
  }

  async uploadProfileImage(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);

    if (!request.file) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Imagem de perfil obrigatória." });
    }

    const parsed = uploadProfileImageSchema.safeParse({
      image: {
        content: request.file.buffer,
        contentType: request.file.mimetype,
        size: request.file.size,
      },
    });
    if (!parsed.success) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Dados da imagem de perfil inválidos.", cause: parsed.error });
    }

    const result = await this.userService.uploadProfileImage({ userId, ...parsed.data });
    sendSuccess(response, result);
  };

  async deactivateMyAccount(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    await this.userService.deactivateMyAccount(userId);
    sendNoContent(response);
  }

  async reactivateUserAsAdmin(request: Request, response: Response): Promise<void> {
    const actorUserId = requireUserId(request);
    const targetUserId = request.params.userId;
    if (typeof targetUserId !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(targetUserId)) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "ID do usuário inválido." });
    }
    await this.userService.reactivateUserAsAdmin(actorUserId, targetUserId);
    sendNoContent(response);
  }
}

function requireUserId(request: Request): string {
  const userId = (request as AuthenticatedRequest).auth?.userId;
  if (!userId) throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Autenticação obrigatória." });
  return userId;
}
