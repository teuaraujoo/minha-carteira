import { randomUUID } from "node:crypto";
import { Resend } from "resend";
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
import { createUsersRouter } from "../modules/users/presentation/routes/users.routes.js";
import { createPinoAppLogger } from "../shared/infrastructure/logging/pino-app-logger.js";
import { createApp } from "./app.js";
import { ResendEmailProvider } from "../modules/auth/infrastructure/providers/resend-email.provider.js";
import { PrismaPasswordResetUnitOfWork } from "../modules/auth/infrastructure/repositories/password-reset.unit-of-work.js";
import { CryptoTokenGenerator } from "../modules/auth/infrastructure/security/crypto-token.generator.js";
import { InMemoryPasswordResetRateLimiter } from "../modules/auth/infrastructure/security/in-memory-password-reset-rate-limiter.js";

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
  const passwordResetUnitOfWork = new PrismaPasswordResetUnitOfWork(
    prisma,
    (transaction) => new UserService(
      new PrismaUsersRepository(transaction),
      storageService,
      logger,
      passwordHasher,
      idGenerator,
      clock,
    ),
  );
  const emailProvider = new ResendEmailProvider(
    new Resend(requiredEnvironment("RESEND_API_KEY")),
    requiredEnvironment("RESEND_FROM_EMAIL"),
  );
  const authService = new AuthService(refreshTokenRepository, clock, tokenHasher, passwordHasher, usersService, jwtProvider, idGenerator, {
    unitOfWork: passwordResetUnitOfWork,
    emailProvider,
    tokenGenerator: new CryptoTokenGenerator(),
    rateLimiter: new InMemoryPasswordResetRateLimiter(),
    frontendUrl: requiredFrontendUrl(),
    logger,
  });
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
  const usersRouter = createUsersRouter({
    userService: usersService,
    jwtProvider,
    refreshTokenRepository,
    usersAuthGateway: usersService,
    clock,
    allowedOrigins,
  });
  const app = createApp({ logger, authRouter, usersRouter, allowedOrigins });

  return { app, logger };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  return value;
}

function requiredFrontendUrl(): string {
  const value = requiredEnvironment("FRONTEND_URL");
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("A variável de ambiente FRONTEND_URL deve conter uma URL HTTPS válida.");
  }
}

function configuredOrigins(): string[] {
  const value = process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_URL ?? "";
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}
