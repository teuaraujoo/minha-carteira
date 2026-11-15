import type { Request, RequestHandler } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { JwtProvider } from "../../application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";
import type { UserService } from "../../../users/application/services/users.service.js";

export type AccessTokenResolver = (request: Request) => string | undefined;

export interface AuthenticationMiddlewareDependencies {
  jwtProvider: JwtProvider;
  refreshTokenRepository: IRefreshTokenRepository;
  userService: UserService
}

export function createAuthenticationMiddleware(
  dependencies: AuthenticationMiddlewareDependencies,
  resolveAccessToken: AccessTokenResolver,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const accessToken = resolveAccessToken(request);
      if (typeof accessToken !== "string" || !accessToken.trim()) throw unauthorized();

      const verified = await dependencies.jwtProvider.verifyAccessToken(accessToken);
      if (verified.type !== "access") throw unauthorized();

      const session = await dependencies.refreshTokenRepository.findActiveById(
        verified.sessionId,
        new Date()
      );
      if (!session || session.userId !== verified.userId) throw unauthorized();

      const user = await dependencies.userService.findActiveUserById(verified.userId);
      if (!user || user.status !== "ACTIVE") throw unauthorized();

      request.auth = { userId: verified.userId, sessionId: verified.sessionId };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function unauthorized(): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Autenticação inválida ou expirada.",
  });
}
