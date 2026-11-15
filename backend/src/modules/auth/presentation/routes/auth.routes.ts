import { Router, type Request } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { RegisterUserInput } from "../../../users/index.js";
import type { JwtProvider, TokenHasher } from "../../application/contracts/auth.contracts.js";
import type { RequestMetadata } from "../../domain/interfaces/auth.interfaces.js";
import { mapLoginOutput } from "../../application/dto/login.dto.js";
import { mapRequestMfaOutput, mapValidateMfaOutput } from "../../application/dto/mfa.dto.js";
import type { AuthService } from "../../application/services/auth.service.js";
import { createAuthenticationMiddleware } from "../middlewares/authentication.middleware.js";
import { createCsrfToken, createCsrfValidationMiddleware, createOriginValidationMiddleware } from "../middlewares/csrf.middleware.js";
import { createUserSchema } from "../../../users/presentation/schemas/users.schemas.js";
import {
  confirmAccountReactivationSchema,
  confirmPasswordResetSchema,
  loginSchema,
  requestAccountReactivationSchema,
  requestMfaSchema,
  requestPasswordResetSchema,
  validateMfaSchema,
} from "../schemas/auth.schemas.js";
import {
  AUTH_COOKIE_NAMES,
  CSRF_COOKIE_OPTIONS,
  clearAuthenticationCookies,
  clearOnboardingCookie,
  setAuthenticationCookies,
  setOnboardingCookie,
} from "../security/auth-cookies.js";
import type { UserService } from "../../../users/application/services/users.service.js";
import type { IRefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";


export function createAuthRouter(
  authService: AuthService,
  tokenHasher: TokenHasher,
  jwtProvider: JwtProvider,
  userService: UserService,
  refreshTokenRepository: IRefreshTokenRepository,
  allowedOrigins: string[]
): Router {
  const router = Router();
  const origins = new Set(allowedOrigins);
  const validateOrigin = createOriginValidationMiddleware(origins);
  const validateCsrf = createCsrfValidationMiddleware(origins);
  const authenticate = createAuthenticationMiddleware(
    { jwtProvider, refreshTokenRepository, userService },
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
    const user = await userService.registerUser(parsed.data as RegisterUserInput);
    sendCreated(response, user);
  });

  router.post("/login", validateCsrf, async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados de login inválidos.", parsed.error);
    const result = await authService.login(parsed.data);
    setAuthenticationCookies(response, result.accessToken, result.refreshToken);
    sendSuccess(response, mapLoginOutput(result.user));
  });

  router.post("/refresh", validateCsrf, async (request, response) => {
    const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refresh];
    if (typeof refreshToken !== "string" || !refreshToken) {
      throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Token inválido ou expirado." });
    }
    const result = await authService.refresh({ refreshToken });
    setAuthenticationCookies(response, result.accessToken);
    sendNoContent(response);
  });

  router.post("/logout", validateCsrf, async (request, response) => {
    const sessionId = await resolveLogoutSessionId(request, tokenHasher);
    await authService.logout({ sessionId });
    clearAuthenticationCookies(response);
    sendNoContent(response);
  });

  router.post("/password-reset", validateCsrf, async (request, response) => {
    const parsed = requestPasswordResetSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para recuperação de senha inválidos.", parsed.error);
    await authService.requestPasswordReset({
      email: parsed.data.email,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    response.status(202).json({ data: { message: "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha." } });
  });

  router.post("/password-reset/confirm", validateCsrf, async (request, response) => {
    const parsed = confirmPasswordResetSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para redefinição de senha inválidos.", parsed.error);
    await authService.confirmPasswordReset({
      token: parsed.data.token,
      password: parsed.data.password,
      passwordConfirmation: parsed.data.passwordConfirmation,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    sendNoContent(response);
  });

  router.post("/account-reactivation", validateCsrf, async (request, response) => {
    const parsed = requestAccountReactivationSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para solicitação de reativação inválidos.", parsed.error);
    await authService.requestAccountReactivation({
      email: parsed.data.email,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    response.status(202).json({ data: { message: "Se houver uma conta inativa associada ao e-mail, você receberá um link para reativá-la." } });
  });

  router.post("/account-reactivation/confirm", validateCsrf, async (request, response) => {
    const parsed = confirmAccountReactivationSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para confirmação de reativação inválidos.", parsed.error);
    await authService.confirmAccountReactivation({
      token: parsed.data.token,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    sendNoContent(response);
  });

  router.get("/me", authenticate, (request, response) => {
    const context = request.auth;
    if (!context) throw new AppError({ status: 401, code: ErrorCode.UNAUTHORIZED, message: "Autenticação obrigatória." });
    sendSuccess(response, { userId: context.userId, sessionId: context.sessionId });
  });

  router.post("/request-mfa", validateCsrf, async (request, response) => {
    const parsed = requestMfaSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para solicitação de código MFA inválidos.", parsed.error);
    const result = await authService.requestMfa({
      email: parsed.data.email,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    sendSuccess(response, mapRequestMfaOutput(result));
  });

  router.post("/validate-mfa", validateCsrf, async (request, response) => {
    const parsed = validateMfaSchema.safeParse(request.body);
    if (!parsed.success) throw validationError("Dados para validação do código MFA inválidos.", parsed.error);
    const result = await authService.validateMfa({
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
      metadata: buildRequestMetadata(parsed.data.metadata, request),
    });
    if (result.isRegistered) {
      clearOnboardingCookie(response);
      setAuthenticationCookies(response, result.accessToken, result.refreshToken);
    } else {
      setOnboardingCookie(response, result.accessToken);
    }
    sendSuccess(response, mapValidateMfaOutput(result));
  });

  
async function resolveLogoutSessionId(
  request: Request,
  tokenHasher: TokenHasher,
): Promise<string | null> {
  const now = new Date()
  const accessToken = request.cookies?.[AUTH_COOKIE_NAMES.access];
  if (typeof accessToken === "string" && accessToken) {
    let accessClaims;
    try {
      accessClaims = await jwtProvider.verifyAccessToken(accessToken);
    } catch {
      accessClaims = null;
    }
    if (accessClaims?.type === "access") {
      const session = await refreshTokenRepository.findActiveById(
        accessClaims.sessionId,
        now,
      );
      if (session?.userId === accessClaims.userId) return session.id;
    }
  }

  const refreshToken = request.cookies?.[AUTH_COOKIE_NAMES.refresh];
  if (typeof refreshToken !== "string" || !refreshToken) return null;
  let refreshClaims;
  try {
    refreshClaims = await jwtProvider.verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }
  if (refreshClaims.type !== "refresh") return null;
  const session = await refreshTokenRepository.findActiveById(
    refreshClaims.sessionId,
    now,
  );
  if (!session || session.userId !== refreshClaims.userId
    || !await tokenHasher.matches(refreshToken, session.tokenHash)) return null;
  return session.id;
}

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

function validationError(message: string, cause: unknown): AppError {
  return new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message, cause });
}
