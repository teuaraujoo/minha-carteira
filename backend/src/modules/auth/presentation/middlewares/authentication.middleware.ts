import type { Request, RequestHandler } from "express";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import type { JwtProvider, RefreshTokenRepository } from "../../application/contracts/auth.contracts.js";

export type AccessTokenResolver = (request: Request) => string | undefined;

export interface AuthenticationMiddlewareDependencies {
  jwtProvider: JwtProvider;
  refreshTokenRepository: RefreshTokenRepository;
  usersAuthGateway: UsersAuthGateway;
  clock: ClockProvider;
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
        dependencies.clock.now(),
      );
      if (!session || session.userId !== verified.userId) throw unauthorized();

      const user = await dependencies.usersAuthGateway.findActiveUserById(verified.userId);
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
