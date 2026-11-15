import { Router } from "express";
import type { JwtProvider } from "../../../auth/application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../../auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthenticationMiddleware } from "../../../auth/presentation/middlewares/authentication.middleware.js";
import { createCsrfValidationMiddleware } from "../../../auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../../auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../../users/application/services/users.service.js";
import type { TransactionsService } from "../../application/services/transactions.service.js";
import { TransactionsController } from "../controllers/transactions.controller.js";

export function createTransactionsRouter(
  transactionsService: TransactionsService,
  jwtProvider: JwtProvider,
  refreshTokenRepository: IRefreshTokenRepository,
  userService: UserService,
  allowedOrigins: readonly string[],
): Router {
  const router = Router();
  const controller = new TransactionsController(transactionsService);
  const authenticate = createAuthenticationMiddleware(
    { jwtProvider, refreshTokenRepository, userService },
    (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );
  const requireCsrf = createCsrfValidationMiddleware(new Set(allowedOrigins));

  router.use(authenticate);

  router.post("/", requireCsrf, controller.create);
  router.get("/", controller.list);
  router.get("/:transactionId", controller.getById);
  router.patch("/:transactionId/confirm", requireCsrf, controller.confirm);
  router.delete("/:transactionId", requireCsrf, controller.delete);

  return router;
}
