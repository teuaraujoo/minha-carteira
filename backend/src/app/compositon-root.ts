import { randomUUID } from "node:crypto";
import { BcryptPasswordHasher } from "../shared/infrastructure/security/bcrypt-password-hasher.js";
import prisma from "../shared/infrastructure/database/prisma-client.js";
import { PrismaUsersRepository } from "../modules/users/infrastructure/repositories/users.repository.js";
import { UserService } from "../modules/users/application/services/users.service.js";
import { JsonWebTokenProvider } from "../modules/auth/infrastructure/security/jsonwebtoken.provider.js";
import { Sha256TokenHasher } from "../modules/auth/infrastructure/security/sha256-token.hasher.js";
import { PrismaRefreshTokenRepository } from "../modules/auth/infrastructure/repositories/refresh-token.repository.js";
import { AuthService } from "../modules/auth/application/services/auth.service.js";
import { StorageService, PrismaStoredFileRepository, createR2Client, R2StorageService } from "../modules/storage/index.js";
import { createAuthRouter } from "../modules/auth/presentation/routes/auth.routes.js";
import { createPinoAppLogger } from "../shared/infrastructure/logging/pino-app-logger.js";
import { createApp } from "./app.js";

export function createCompositionRoot() {
  const logger = createPinoAppLogger();
  const clock = { now: () => new Date() };
  const idGenerator = { generate: () => randomUUID() };
  const passwordHasher = new BcryptPasswordHasher(Number(process.env.BCRYPT_SALT_ROUNDS ?? 12));
  const usersRepository = new PrismaUsersRepository(prisma);
  const r2 = createR2Client({
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ID ?? "",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT ?? "",
    bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? "",
  });
  const storageService = new StorageService(new PrismaStoredFileRepository(), new R2StorageService(r2.client, r2.bucket));
  const usersService = new UserService(usersRepository, storageService, logger, passwordHasher, idGenerator, clock);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
  const jwtProvider = new JsonWebTokenProvider(process.env.JWT_SECRET);
  const tokenHasher = new Sha256TokenHasher();
  const allowedOrigins = configuredOrigins();
  const authService = new AuthService(refreshTokenRepository, clock, tokenHasher, passwordHasher, usersService, jwtProvider, idGenerator);
  const authRouter = createAuthRouter({
    authService,
    usersRegistrationGateway: usersService,
    jwtProvider,
    refreshTokenRepository,
    usersAuthGateway: usersService,
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
