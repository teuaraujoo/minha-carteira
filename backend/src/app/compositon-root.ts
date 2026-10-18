import { randomUUID } from "node:crypto";
import { BcryptPasswordHasher } from "../shared/infrastructure/security/bcrypt-password-hasher.js";
import prisma from "../shared/infrastructure/database/prisma-client.js";
import { PrismaUsersRepository } from "../modules/users/infrastructure/repositories/users.repository.js";
import { RegisterUserUseCase } from "../modules/users/application/use-cases/register-user.use-case.js";
import { UsersAuthGatewayAdapter } from "../modules/users/infrastructure/adapters/users-auth-gateway.adapter.js";
import { UsersRegistrationGatewayAdapter } from "../modules/users/infrastructure/adapters/users-registration-gateway.adapter.js";
import { JsonWebTokenProvider } from "../modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { Sha256TokenHasher } from "../modules/auth/infrastructure/security/sha256-token.hasher.js";
import { PrismaRefreshTokenRepository } from "../modules/auth/infrastructure/repositories/prisma-refresh-token.repository.js";
import { LoginUseCase } from "../modules/auth/application/use-cases/login.use-case.js";
import { RefreshSessionUseCase } from "../modules/auth/application/use-cases/refresh-session.use-case.js";
import { LogoutSessionUseCase } from "../modules/auth/application/use-cases/logout-session.use-case.js";
import { createAuthRouter } from "../modules/auth/presentation/routes/auth.routes.js";
import { createPinoAppLogger } from "../shared/infrastructure/logging/pino-app-logger.js";
import { createApp } from "./app.js";

export function createCompositionRoot() {
  const logger = createPinoAppLogger();
  const clock = { now: () => new Date() };
  const idGenerator = { generate: () => randomUUID() };
  const passwordHasher = new BcryptPasswordHasher(Number(process.env.BCRYPT_SALT_ROUNDS ?? 12));
  const usersRepository = new PrismaUsersRepository(prisma);
  const usersAuthGateway = new UsersAuthGatewayAdapter(usersRepository, clock);
  const registerUserUseCase = new RegisterUserUseCase(usersRepository, passwordHasher, idGenerator, clock);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
  const jwtProvider = new JsonWebTokenProvider(process.env.JWT_SECRET);
  const tokenHasher = new Sha256TokenHasher();
  const allowedOrigins = configuredOrigins();
  const authRouter = createAuthRouter({
    loginUseCase: new LoginUseCase({
      usersAuthGateway,
      passwordHasher,
      idGenerator,
      jwtProvider,
      tokenHasher,
      refreshTokenRepository,
      clock,
    }),
    refreshSessionUseCase: new RefreshSessionUseCase({
      jwtProvider,
      refreshTokenRepository,
      usersAuthGateway,
      tokenHasher,
      clock,
    }),
    logoutSessionUseCase: new LogoutSessionUseCase({ refreshTokenRepository, clock }),
    usersRegistrationGateway: new UsersRegistrationGatewayAdapter(registerUserUseCase),
    jwtProvider,
    refreshTokenRepository,
    usersAuthGateway,
    clock,
    allowedOrigins,
    tokenHasher,
  });
  const app = createApp({ logger, authRouter, allowedOrigins });

  return { app, logger };
}

function configuredOrigins(): string[] {
  const value = process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_URL ?? "";
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}
