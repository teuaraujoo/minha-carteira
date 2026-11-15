import { Router } from "express";
import type { JwtProvider } from "../../../auth/application/contracts/auth.contracts.js";
import type { IRefreshTokenRepository } from "../../../auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { createAuthenticationMiddleware } from "../../../auth/presentation/middlewares/authentication.middleware.js";
import { createCsrfValidationMiddleware } from "../../../auth/presentation/middlewares/csrf.middleware.js";
import { AUTH_COOKIE_NAMES } from "../../../auth/presentation/security/auth-cookies.js";
import type { UserService } from "../../../users/application/services/users.service.js";
import type { CategoriesService } from "../../application/services/categories.service.js";
import { CategoriesController } from "../controllers/categories.controller.js";

export function createCategoriesRouter(
  categoriesService: CategoriesService,
  jwtProvider: JwtProvider,
  refreshTokenRepository: IRefreshTokenRepository,
  userService: UserService,
  allowedOrigins: readonly string[],
): Router {
  const router = Router();
  const controller = new CategoriesController(categoriesService);
  const authenticate = createAuthenticationMiddleware(
    { jwtProvider, refreshTokenRepository, userService },
    (request) => request.cookies?.[AUTH_COOKIE_NAMES.access],
  );
  const requireCsrf = createCsrfValidationMiddleware(new Set(allowedOrigins));

  router.use(authenticate);

  router.get("/", controller.list);
  router.post("/", requireCsrf, controller.create);
  router.get("/:categoryId", controller.getById);
  router.patch("/:categoryId", requireCsrf, controller.update);
  router.patch("/:categoryId/deactivate", requireCsrf, controller.deactivate);
  router.patch("/:categoryId/reactivate", requireCsrf, controller.reactivate);
  router.delete("/:categoryId", requireCsrf, controller.delete);

  return router;
}
