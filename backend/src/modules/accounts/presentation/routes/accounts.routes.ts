import { Router } from "express";
import type { JwtProvider } from "../../../auth/application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../../auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthenticationMiddleware } from "../../../auth/presentation/middlewares/authentication.middleware.js";
import { createCsrfValidationMiddleware } from "../../../auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../../auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../../users/application/services/users.service.js";
import type { AccountsService } from "../../application/services/accounts.service.js";
import { AccountsController } from "../controllers/accounts.controller.js";

export function createAccountsRouter(
  accountsService: AccountsService,
  jwtProvider: JwtProvider,
  refreshTokenRepository: IRefreshTokenRepository,
  userService: UserService,
  allowedOrigins: string[],
): Router {
  const router = Router();
  const controller = new AccountsController(accountsService);
  const authenticate = createAuthenticationMiddleware(
    { jwtProvider, refreshTokenRepository, userService },
    (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );
  const validateCsrf = createCsrfValidationMiddleware(new Set(allowedOrigins));

  router.post("/", authenticate, validateCsrf, (request, response) => controller.create(request, response));
  router.get("/", authenticate, (request, response) => controller.list(request, response));
  router.get("/:accountId", authenticate, (request, response) => controller.getById(request, response));
  router.patch("/:accountId", authenticate, validateCsrf, (request, response) => controller.update(request, response));
  router.patch("/:accountId/deactivate", authenticate, validateCsrf, (request, response) => controller.deactivate(request, response));
  router.patch("/:accountId/reactivate", authenticate, validateCsrf, (request, response) => controller.reactivate(request, response));
  router.delete("/:accountId", authenticate, validateCsrf, (request, response) => controller.delete(request, response));

  return router;
}
