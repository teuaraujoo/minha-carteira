import { Router } from "express";
import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { JwtProvider } from "../../../auth/application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../../auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthenticationMiddleware } from "../../../auth/presentation/middlewares/authentication.middleware.js";
import { createCsrfValidationMiddleware } from "../../../auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../../auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../application/services/users.service.js";
import { UserController } from "../controllers/users.controller.js";
import { profileImageUpload } from "../middlewares/image-upload.middleware.js";
import type { UsersAuthGateway } from "../../index.js";

export interface UsersRoutesDependencies {
  userService: UserService;
  jwtProvider: JwtProvider;
  refreshTokenRepository: IRefreshTokenRepository;
  usersAuthGateway: UsersAuthGateway;
  clock: ClockProvider;
  allowedOrigins: readonly string[];
}

export function createUsersRouter(dependencies: UsersRoutesDependencies): Router {
  const router = Router();
  const controller = new UserController(dependencies.userService);
  const authenticate = createAuthenticationMiddleware(
    dependencies,
    (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );
  const validateCsrf = createCsrfValidationMiddleware(new Set(dependencies.allowedOrigins));

  router.get("/me", authenticate, (request, response) => controller.getMyProfile(request, response));
  router.patch("/me", authenticate, validateCsrf, (request, response) => controller.updateMyProfile(request, response));
  router.post("/me/profile-image", authenticate, validateCsrf, profileImageUpload, (request, response) => controller.uploadProfileImage(request, response));
  router.post("/me/deactivate", authenticate, validateCsrf, (request, response) => controller.deactivateMyAccount(request, response));
  router.post("/:userId/reactivate", authenticate, validateCsrf, (request, response) => controller.reactivateUserAsAdmin(request, response));

  return router;
}
