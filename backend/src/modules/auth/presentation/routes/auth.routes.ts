import { Router, type Request } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { RegisterUserInput } from "../../../users/index.js";
import { UserIdentityConflictError } from "../../../users/index.js";
import type { TokenHasher } from "../../application/contracts/auth.contracts.js";
import type { LoginSessionResult } from "../../application/dto/login.dto.js";
import { mapLoginOutput } from "../../application/dto/login.dto.js";
import { InvalidCredentialsError } from "../../application/errors/invalid-credentials.error.js";
import type { LoginUseCase } from "../../application/use-cases/login.use-case.js";
import type { LogoutSessionUseCase } from "../../application/use-cases/logout-session.use-case.js";
import type { RefreshSessionUseCase } from "../../application/use-cases/refresh-session.use-case.js";
import { createAuthenticationMiddleware } from "../middlewares/authentication.middleware.js";
import { createCsrfToken, createCsrfValidationMiddleware, createOriginValidationMiddleware } from "../middlewares/csrf.middleware.js";
import { createUserSchema } from "../../../users/presentation/schemas/users.schemas.js";
import { loginSchema } from "../schemas/auth.schemas.js";
import { AUTH_COOKIE_NAMES, CSRF_COOKIE_OPTIONS, clearAuthenticationCookies, setAuthenticationCookies } from "../security/auth-cookies.js";
import type { AuthenticationMiddlewareDependencies } from "../middlewares/authentication.middleware.js";
import type { UsersRegistrationGateway } from "../../../users/index.js";

export interface AuthRoutesDependencies extends AuthenticationMiddlewareDependencies {
  loginUseCase: Pick<LoginUseCase, "execute">;
  refreshSessionUseCase: Pick<RefreshSessionUseCase, "execute">;
  logoutSessionUseCase: Pick<LogoutSessionUseCase, "execute">;
  usersRegistrationGateway: UsersRegistrationGateway;
  allowedOrigins: readonly string[];
  tokenHasher: TokenHasher;
}

export function createAuthRouter(dependencies: AuthRoutesDependencies): Router {
  const router = Router();
  const origins = new Set(dependencies.allowedOrigins);
  const validateOrigin = createOriginValidationMiddleware(origins);
  const validateCsrf = createCsrfValidationMiddleware(origins);
  const authenticate = createAuthenticationMiddleware(
    dependencies,
    (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );

  router.get("/csrf", validateOrigin, (request, response) => {
    const token = createCsrfToken();
    response.cookie(AUTH_COOKIE_NAMES.csrf, token, CSRF_COOKIE_OPTIONS);
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.status(200).json({ data: { token } });
  });

  router.post("/register", validateCsrf, async (request, response) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados de cadastro inválidos.", parsed.error);
    try {
      const user = await dependencies.usersRegistrationGateway.registerUser(parsed.data as RegisterUserInput);
      sendCreated(response, user);
    } catch (error) {
      if (error instanceof UserIdentityConflictError) {
        throw new AppError({ status: 409, code: ErrorCode.CONFLICT, message: error.message, cause: error });
      }
      throw error;
    }
  });

  router.post("/login", validateCsrf, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados de login inválidos.", parsed.error);
    try {
      const result: LoginSessionResult = await dependencies.loginUseCase.execute(parsed.data);
      setAuthenticationCookies(response, result.accessToken, result.refreshToken);
      sendSuccess(response, mapLoginOutput(result.user));
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: error.message, cause: error });
      }
      throw error;
    }
  });

  router.post("/refresh", validateCsrf, async (request, response) => {
    const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refresh];
    if (typeof refreshToken !== "string" || !refreshToken) {
      throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Token inválido ou expirado." });
    }
    const result = await dependencies.refreshSessionUseCase.execute({ refreshToken });
    setAuthenticationCookies(response, result.accessToken);
    sendNoContent(response);
  });

  router.post("/logout", validateCsrf, async (request, response) => {
    const sessionId = await resolveLogoutSessionId(request, dependencies);
    await dependencies.logoutSessionUseCase.execute({ sessionId });
    clearAuthenticationCookies(response);
    sendNoContent(response);
  });

  router.get("/me", authenticate, (request, response) => {
    const context = request.auth;
    if (!context) throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Autenticação obrigatória." });
    sendSuccess(response, { userId: context.userId, sessionId: context.sessionId });
  });

  return router;
}

async function resolveLogoutSessionId(
  request: Request,
  dependencies: Pick<AuthRoutesDependencies, "jwtProvider" | "refreshTokenRepository" | "tokenHasher" | "clock">,
): Promise<string | null> {
  const accessToken = request.cookies?.[AUTH_COOKIE_NAMES.access];
  if (typeof accessToken === "string" && accessToken) {
    let accessClaims;
    try {
      accessClaims = await dependencies.jwtProvider.verifyAccessToken(accessToken);
    } catch {
      accessClaims = null;
    }
    if (accessClaims?.type === "access") {
      const session = await dependencies.refreshTokenRepository.findActiveById(
        accessClaims.sessionId,
        dependencies.clock.now(),
      );
      if (session?.userId === accessClaims.userId) return session.id;
    }
  }

  const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refresh];
  if (typeof refreshToken !== "string" || !refreshToken) return null;
  let refreshClaims;
  try {
    refreshClaims = await dependencies.jwtProvider.verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }
  if (refreshClaims.type !== "refresh") return null;
  const session = await dependencies.refreshTokenRepository.findActiveById(
    refreshClaims.sessionId,
    dependencies.clock.now(),
  );
  if (!session || session.userId !== refreshClaims.userId
    || !await dependencies.tokenHasher.matches(refreshToken, session.tokenHash)) return null;
  return session.id;
}

function validationError(message: string, cause: unknown): AppError {
  return new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message, cause });
}
