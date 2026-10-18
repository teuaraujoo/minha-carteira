import { Router, type Request } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { RegisterUserInput } from "../../../users/index.js";
import type { TokenHasher } from "../../application/contracts/auth.contracts.js";
import type { RequestMetadata } from "../../domain/entities/auth.entities.js";
import { mapLoginOutput } from "../../application/dto/login.dto.js";
import type { AuthService } from "../../application/services/auth.service.js";
import { createAuthenticationMiddleware } from "../middlewares/authentication.middleware.js";
import { createCsrfToken, createCsrfValidationMiddleware, createOriginValidationMiddleware } from "../middlewares/csrf.middleware.js";
import { createUserSchema } from "../../../users/presentation/schemas/users.schemas.js";
import { confirmPasswordResetSchema, loginSchema, requestPasswordResetSchema } from "../schemas/auth.schemas.js";
import { AUTH_COOKIE_NAMES, CSRF_COOKIE_OPTIONS, clearAuthenticationCookies, setAuthenticationCookies } from "../security/auth-cookies.js";
import type { AuthenticationMiddlewareDependencies } from "../middlewares/authentication.middleware.js";
import type { UsersRegistrationGateway } from "../../../users/index.js";

export interface AuthRoutesDependencies extends AuthenticationMiddlewareDependencies {
  authService: Pick<AuthService, "login" | "refresh" | "logout" | "requestPasswordReset" | "confirmPasswordReset">;
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
    const user = await dependencies.usersRegistrationGateway.registerUser(parsed.data as RegisterUserInput);
    sendCreated(response, user);
  });

  router.post("/login", validateCsrf, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados de login inválidos.", parsed.error);
    const result = await dependencies.authService.login(parsed.data);
    setAuthenticationCookies(response, result.accessToken, result.refreshToken);
    sendSuccess(response, mapLoginOutput(result.user));
  });

  router.post("/refresh", validateCsrf, async (request, response) => {
    const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refresh];
    if (typeof refreshToken !== "string" || !refreshToken) {
      throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Token inválido ou expirado." });
    }
    const result = await dependencies.authService.refresh({ refreshToken });
    setAuthenticationCookies(response, result.accessToken);
    sendNoContent(response);
  });

  router.post("/logout", validateCsrf, async (request, response) => {
    const sessionId = await resolveLogoutSessionId(request, dependencies);
    await dependencies.authService.logout({ sessionId });
    clearAuthenticationCookies(response);
    sendNoContent(response);
  });

  router.post("/password-reset", validateCsrf, async (request, response) => {
    const parsed = requestPasswordResetSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para recuperação de senha inválidos.", parsed.error);
    await dependencies.authService.requestPasswordReset({
      email: parsed.data.email,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    response.status(202).json({ data: { message: "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha." } });
  });

  router.post("/password-reset/confirm", validateCsrf, async (request, response) => {
    const parsed = confirmPasswordResetSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para redefinição de senha inválidos.", parsed.error);
    await dependencies.authService.confirmPasswordReset({
      token: parsed.data.token,
      password: parsed.data.password,
      passwordConfirmation: parsed.data.passwordConfirmation,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    sendNoContent(response);
  });

  router.get("/me", authenticate, (request, response) => {
    const context = request.auth;
    if (!context) throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Autenticação obrigatória." });
    sendSuccess(response, { userId: context.userId, sessionId: context.sessionId });
  });

  return router;
}

function buildRequestMetadata(
  input: { location?: { latitude: number; longitude: number } | null | undefined; deviceId?: string | null | undefined } | undefined,
  request: Request,
): RequestMetadata {
  return {
    location: input?.location ?? null,
    deviceId: input?.deviceId ?? null,
    userAgent: request.get("user-agent") ?? null,
    ipAddress: request.ip ?? null,
  };
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
