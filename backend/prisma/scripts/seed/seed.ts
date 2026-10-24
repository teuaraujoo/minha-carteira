import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { BcryptPasswordHasher } from "../../../src/shared/infrastructure/security/bcrypt-password-hasher.js";
import { createPinoAppLogger } from "../../../src/shared/infrastructure/logging/pino-app-logger.js";
import { createR2Client } from "../../../src/modules/storage/infrastructure/providers/cloudflare-r2/r2-client.js";
import { R2StorageService } from "../../../src/modules/storage/infrastructure/providers/cloudflare-r2/r2-storage.service.js";
import { validateStoredFile } from "../../../src/modules/storage/domain/validation/file-validation.js";
import { createDemoHistory, createDemoUsers, DEMO_AVATAR, DEMO_USERS } from "../data/demo-data.js";
import { listApplicationTables, resolveMaintenanceTarget } from "../database-maintenance.js";

const logger = createPinoAppLogger({ pretty: false });

function requiredEnvironment(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) throw new Error(`A variável de ambiente ${key} é obrigatória para o seed.`);
  return value;
}

try {
  const target = resolveMaintenanceTarget(process.env);
  const users = await createDemoUsers(
    { admin: requiredEnvironment("SEED_ADMIN_PASSWORD"), user: requiredEnvironment("SEED_USER_PASSWORD") },
    new BcryptPasswordHasher(Number(process.env.BCRYPT_SALT_ROUNDS ?? 12)),
    new Date(Date.now() - 2 * 60 * 60 * 1000),
  );
  const image = validateStoredFile(DEMO_AVATAR, "image/png");
  const r2 = createR2Client({
    accessKeyId: requiredEnvironment("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironment("CLOUDFLARE_R2_SECRET_ID"),
    endpoint: requiredEnvironment("CLOUDFLARE_R2_ENDPOINT"),
    bucket: requiredEnvironment("CLOUDFLARE_R2_BUCKET_NAME"),
  });
  const storage = new R2StorageService(r2.client, r2.bucket);
  const pool = new Pool({ connectionString: target.connectionString });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: target.connectionString }, { schema: target.schema }),
  });
  try {
    const client = await pool.connect();
    try { await listApplicationTables(client, target.schema); } finally { client.release(); }
    const history = createDemoHistory(new Date());
    await prisma.$transaction(async transaction => {
      // IDs e identidades reservados impedem promover ou sobrescrever contas preexistentes.
      const existing = await transaction.user.findMany({
        where: { OR: [{ id: { in: DEMO_USERS.map(user => user.id) } }, { username: { in: DEMO_USERS.map(user => user.username) } }, { email: { in: DEMO_USERS.map(user => user.email) } }] },
      });
      for (const user of existing) {
        const expected = DEMO_USERS.find(item => item.id === user.id);
        if (!expected || expected.username !== user.username || expected.email !== user.email || expected.role !== user.role) {
          throw new Error("Uma conta existente conflita com as identidades reservadas do seed; nenhum usuário foi alterado.");
        }
      }
      const previousRequest = await transaction.passwordResetRequest.findUnique({ where: { id: history.request.id! } });
      if (previousRequest && previousRequest.userId !== history.request.userId) {
        throw new Error("Uma solicitação existente conflita com o histórico reservado do seed.");
      }
      for (const challenge of history.challenges) {
        const previous = await transaction.challenge.findUnique({ where: { id: challenge.id! } });
        if (previous && (previous.subjectId !== challenge.subjectId || previous.subjectType !== challenge.subjectType || previous.purpose !== challenge.purpose || previous.secretHash !== challenge.secretHash)) {
          throw new Error("Um desafio existente conflita com o histórico reservado do seed.");
        }
      }
      const previousSession = await transaction.refreshToken.findUnique({ where: { id: history.refreshToken.id! } });
      if (previousSession && (previousSession.userId !== history.refreshToken.userId || previousSession.tokenHash !== history.refreshToken.tokenHash)) {
        throw new Error("Uma sessão existente conflita com o histórico reservado do seed.");
      }
      for (const user of users) await transaction.user.upsert({ where: { id: user.id }, update: {}, create: user });
      await transaction.passwordResetRequest.upsert({ where: { id: history.request.id! }, update: {}, create: history.request });
      for (const challenge of history.challenges) await transaction.challenge.upsert({ where: { id: challenge.id! }, update: {}, create: challenge });
      await transaction.refreshToken.upsert({ where: { id: history.refreshToken.id! }, update: {}, create: history.refreshToken });
    });
    for (const [index, user] of DEMO_USERS.slice(0, 3).entries()) {
      const id = `75000000-0000-4000-8000-00000000000${index + 1}`;
      const storageKey = `seed/users/${user.id}/avatar.png`;
      const existing = await prisma.storedFile.findFirst({ where: { OR: [{ id }, { storageProvider: "CLOUDFLARE_R2", storageKey }] } });
      if (existing && (existing.id !== id || existing.storageProvider !== "CLOUDFLARE_R2" || existing.storageKey !== storageKey || existing.ownerUserId !== user.id || existing.contextId !== user.id || existing.contextType !== "USER_PROFILE")) {
        throw new Error("Um arquivo existente conflita com os identificadores reservados do seed.");
      }
      await prisma.storedFile.upsert({
        where: { id },
        update: { status: "UPLOADING", deletedAt: null, mimeType: "image/png", originalName: `${user.username}.png`, checksum: image.checksum, sizeInBytes: image.sizeInBytes },
        create: { id, ownerUserId: user.id, contextId: user.id, contextType: "USER_PROFILE", storageProvider: "CLOUDFLARE_R2", storageKey, originalName: `${user.username}.png`, mimeType: "image/png", ...image, status: "UPLOADING" },
      });
      try {
        await storage.upload(storageKey, DEMO_AVATAR, "image/png");
        await prisma.storedFile.update({ where: { id }, data: { status: "COMPLETED" } });
      } catch (error) {
        await prisma.storedFile.update({ where: { id }, data: { status: "FAILED" } });
        throw error;
      }
    }
    logger.info({ event: "database.seed.completed", module: "database", message: "Seed concluído: quatro usuários, três imagens reais no R2 e históricos de autenticação sem tokens utilizáveis." });
  } finally {
    await prisma.$disconnect();
    await pool.end();
    r2.client.destroy();
  }
} catch (error) {
  logger.error({ event: "database.seed.failed", module: "database", message: "Não foi possível concluir o seed. Corrija a configuração e execute novamente; dados já criados são preservados.", error });
  process.exitCode = 1;
} finally { await logger.close(); }
