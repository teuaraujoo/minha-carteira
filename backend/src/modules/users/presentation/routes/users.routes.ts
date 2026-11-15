import { Router } from "express";
import type { JwtProvider } from "../../../auth/application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../../auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthenticationMiddleware } from "../../../auth/presentation/middlewares/authentication.middleware.js";
import { createCsrfValidationMiddleware } from "../../../auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../../auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../application/services/users.service.js";
import { UserController } from "../controllers/users.controller.js";
import { profileImageUpload } from "../middlewares/image-upload.middleware.js";
import type { AuthService } from "../../../auth/application/services/auth.service.js";


export function createUsersRouter(
  userService: UserService,
  jwtProvider: JwtProvider,
  refreshTokenRepository: IRefreshTokenRepository,
  allowedOrigins: string[]
): Router {
  const router = Router();
  const controller = new UserController(userService);
  const authenticate = createAuthenticationMiddleware(
    { jwtProvider, refreshTokenRepository, userService },
      (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );
  const validateCsrf = createCsrfValidationMiddleware(new Set(allowedOrigins));

  router.get("/me", authenticate, (request, response) => controller.getMyProfile(request, response));
  router.patch("/me", authenticate, validateCsrf, (request, response) => controller.updateMyProfile(request, response));
  router.post("/me/profile-image", authenticate, validateCsrf, profileImageUpload, (request, response) => controller.uploadProfileImage(request, response));
  router.post("/me/deactivate", authenticate, validateCsrf, (request, response) => controller.deactivateMyAccount(request, response));
  router.post("/:userId/reactivate", authenticate, validateCsrf, (request, response) => controller.reactivateUserAsAdmin(request, response));

  return router;
}
