import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
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

test("desativa a conta e revoga sessões na mesma operação coordenada", async () => {
  const user = activeUser();
  const calls: string[] = [];
  const service = createUserService(
    createUsersRepositoryDouble({
      findActiveById: async () => user,
    }),
    storage(),
    noopLogger,
    {
      createSessionIfAccountActive: async () => true,
      deactivateAccountAndRevokeSessions: async (id, at) => {
        assert.equal(id, userId);
        assert.equal(at.toISOString(), "2026-01-01T00:00:00.000Z");
        calls.push("transaction");
        return true;
      },
      reactivateAccountAndRevokeSessions: async () => ({ found: true, reactivated: true }),
    },
  );

  await service.deactivateMyAccount(userId);

  assert.deepEqual(calls, ["transaction"]);
  assert.equal(user.status, UserStatus.ACTIVE);
});

test("reativa uma conta inativa mantendo todas as sessões antigas revogadas", async () => {
  const user = activeUser();
  user.deactivate(new Date("2026-01-01T00:00:00.000Z"));
  let revokeCount = 0;
  const service = createUserService(
    createUsersRepositoryDouble({ findById: async () => user }),
    storage(),
    noopLogger,
    {
      createSessionIfAccountActive: async () => true,
      deactivateAccountAndRevokeSessions: async () => true,
      reactivateAccountAndRevokeSessions: async () => {
        revokeCount += 1;
        return { found: true, reactivated: true };
      },
    },
  );

  assert.equal(await service.reactivateUserById(userId), true);
  assert.equal(user.status, UserStatus.INACTIVE);
  assert.notEqual(user.inactivatedAt, null);
  assert.equal(revokeCount, 1);
});

test("somente uma conta ADMIN ativa pode reativar outra conta", async () => {
  const target = activeUser();
  target.deactivate(new Date("2026-01-01T00:00:00.000Z"));
  const actor = new User({
    id: "admin-1", username: "admin", name: "Admin", email: "admin@example.com",
    phone: "+5585999999999", role: UserRoles.ADMIN, passwordHash: "hash", capabilities: [],
    status: UserStatus.ACTIVE, createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"), inactivatedAt: null,
  });
  let reactivationCalls = 0;
  const service = createUserService(createUsersRepositoryDouble({
    findActiveById: async (id) => id === actor.id ? actor : null,
    findById: async (id) => id === target.id ? target : null,
  }), storage(), noopLogger, {
    createSessionIfAccountActive: async () => true,
    deactivateAccountAndRevokeSessions: async () => true,
    reactivateAccountAndRevokeSessions: async (id) => {
      assert.equal(id, target.id);
      reactivationCalls += 1;
      return { found: true, reactivated: true };
    },
  });

  await assert.rejects(service.reactivateUserAsAdmin(userId, target.id), (error: unknown) => error instanceof AppError && error.status === 403);
  assert.equal(reactivationCalls, 0);
  await service.reactivateUserAsAdmin(actor.id, target.id);
  assert.equal(reactivationCalls, 1);
  assert.equal(target.status, UserStatus.INACTIVE);
});
