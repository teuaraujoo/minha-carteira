import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { AppError } from "../../src/shared/presentation/http/app-error.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";
import { createUserService } from "./user-service.test-support.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";

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

  const profile = await service.updateMyProfile({ userId, name: "Nome Novo", phone: "+5585888888888" });

  assert.equal(profile.name, "Nome Novo");
  assert.equal(profile.phone, "+5585888888888");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.updatedAt.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("não retorna perfil de usuário ausente ou inativo", async () => {
  const service = createUserService(createUsersRepositoryDouble(), storage(), noopLogger);

  await assert.rejects(service.getMyProfile(userId), (error: unknown) => error instanceof AppError && error.status === 404);
});
