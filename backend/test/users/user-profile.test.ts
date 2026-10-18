import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { AppError } from "../../src/shared/presentation/http/app-error.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";
import { createUserService } from "./user-service.test-support.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const now = new Date("2026-10-18T12:00:00.000Z");

function activeUser(): User {
  return User.create({
    id: userId,
    username: "teco-user",
    name: "Teco User",
    email: "teco@example.com",
    phone: "+5585999999999",
    passwordHash: "hash-secreto",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

function storage(overrides: Partial<StorageOperations> = {}): StorageOperations {
  return {
    upload: async () => undefined,
    delete: async () => undefined,
    getPresignedUrl: async () => "",
    getActiveFileUrl: async () => null,
    replaceFileContent: async () => ({ file: {} as never, url: "", expiresAt: now }),
    ...overrides,
  };
}

function lifecyclePrisma(initialStatus: "ACTIVE" | "INACTIVE" | null = "ACTIVE") {
  const calls: string[] = [];
  let status = initialStatus;
  const transaction = {
    $queryRaw: async () => {
      calls.push("lock-account");
      return status ? [{ status }] : [];
    },
    user: {
      updateMany: async (input: { data: { status: "ACTIVE" | "INACTIVE" } }) => {
        calls.push("update-user");
        status = input.data.status;
        return { count: 1 };
      },
    },
    refreshToken: {
      updateMany: async () => { calls.push("revoke-sessions"); return { count: 1 }; },
    },
    challenge: {
      updateMany: async () => { calls.push("invalidate-challenges"); return { count: 1 }; },
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => operation(transaction),
  } as unknown as PrismaClient;
  return { prisma, calls, get status() { return status; } };
}

test("retorna o perfil autenticado sem hash e com URL temporária quando existe imagem", async () => {
  const user = activeUser();
  const service = createUserService(
    createUsersRepositoryDouble({ findActiveById: async () => user }),
    storage({ getActiveFileUrl: async () => ({ url: "https://storage.example/profile", expiresAt: new Date("2026-10-18T12:30:00.000Z") }) }),
    noopLogger,
  );

  const profile = await service.getMyProfile(userId);

  assert.equal(profile.id, userId);
  assert.deepEqual(profile.profileImage, { url: "https://storage.example/profile", expiresAt: new Date("2026-10-18T12:30:00.000Z") });
  assert.equal(JSON.stringify(profile).includes("hash-secreto"), false);
});

test("atualiza somente nome e telefone e salva a entidade", async () => {
  const user = activeUser();
  const saved: User[] = [];
  const repository = createUsersRepositoryDouble({
    findActiveById: async () => user,
    save: async (profile) => { saved.push(profile); },
  });
  const service = createUserService(repository, storage(), noopLogger);

  const profile = await service.updateMyProfile({ userId, name: "Nome Novo", phone: "+5585998888888" });

  assert.equal(profile.name, "Nome Novo");
  assert.equal(profile.phone, "+5585998888888");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.updatedAt.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("não retorna perfil de usuário ausente ou inativo", async () => {
  const service = createUserService(createUsersRepositoryDouble(), storage(), noopLogger);

  await assert.rejects(service.getMyProfile(userId), (error: unknown) => error instanceof AppError && error.status === 404);
});

test("desativa a conta e revoga sessões na mesma transação do service", async () => {
  const database = lifecyclePrisma();
  const service = createUserService(
    createUsersRepositoryDouble(),
    storage(),
    noopLogger,
    database.prisma,
  );

  await service.deactivateMyAccount(userId);

  assert.deepEqual(database.calls, ["lock-account", "update-user", "revoke-sessions"]);
  assert.equal(database.status, UserStatus.INACTIVE);
});

test("reativa uma conta inativa mantendo todas as sessões antigas revogadas", async () => {
  const database = lifecyclePrisma("INACTIVE");
  const service = createUserService(
    createUsersRepositoryDouble(),
    storage(),
    noopLogger,
    database.prisma,
  );

  assert.equal(await service.reactivateUserById(userId), true);
  assert.equal(database.status, UserStatus.ACTIVE);
  assert.deepEqual(database.calls, ["lock-account", "update-user", "revoke-sessions", "invalidate-challenges"]);
});

test("somente uma conta ADMIN ativa pode reativar outra conta", async () => {
  const database = lifecyclePrisma("INACTIVE");
  const actor = new User({
    id: "admin-1", username: "admin", name: "Admin", email: "admin@example.com",
    phone: "+5585999999999", role: UserRoles.ADMIN, passwordHash: "hash", capabilities: [],
    status: UserStatus.ACTIVE, createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"), inactivatedAt: null,
  });
  const service = createUserService(createUsersRepositoryDouble({
    findActiveById: async (id) => id === actor.id ? actor : null,
  }), storage(), noopLogger, database.prisma);

  await assert.rejects(service.reactivateUserAsAdmin(userId, "target-user"), (error: unknown) => error instanceof AppError && error.status === 403);
  await service.reactivateUserAsAdmin(actor.id, "target-user");
  assert.equal(database.status, UserStatus.ACTIVE);
  assert.deepEqual(database.calls, ["lock-account", "update-user", "revoke-sessions", "invalidate-challenges"]);
});
