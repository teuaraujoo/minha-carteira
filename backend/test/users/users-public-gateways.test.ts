import assert from "node:assert/strict";
import test from "node:test";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import type { UsersAuthGateway, UsersRegistrationGateway } from "../../src/modules/users/index.js";
import { UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";
import { createUserService } from "./user-service.test-support.js";

const storage = { upload: async () => undefined, delete: async () => undefined, getPresignedUrl: async () => "", getActiveFileUrl: async () => null, replaceFileContent: async () => ({ file: {} as never, url: "", expiresAt: new Date() }) } satisfies StorageOperations;

test("UserService implementa os gateways públicos de auth e cadastro", () => {
  const service = createUserService(createUsersRepositoryDouble(), storage);
  const authGateway: UsersAuthGateway = service;
  const registrationGateway: UsersRegistrationGateway = service;
  assert.equal(typeof authGateway.findCredentialsByIdentifier, "function");
  assert.equal(typeof authGateway.findActiveUserById, "function");
  assert.equal(typeof authGateway.changePasswordHash, "function");
  assert.equal(typeof registrationGateway.registerUser, "function");
});

test("gateways de autenticação retornam somente os dados necessários", async () => {
  const user = {
    id: "user-1", username: "ana", name: "Ana", email: "ana@example.com", phone: "",
    role: "USER", passwordHash: "hash-interno", capabilities: [], status: UserStatus.ACTIVE,
    createdAt: new Date(), updatedAt: new Date(), inactivatedAt: null,
    isActive: () => true,
  };
  const service = createUserService(createUsersRepositoryDouble({
    findByEmail: async () => user as never,
    findByIdentifier: async () => user as never,
    findActiveById: async () => user as never,
  }), storage);
  const credentials = await service.findCredentialsByIdentifier("ana@example.com");
  const active = await service.findActiveUserById("user-1");
  const recipient = await service.findActivePasswordResetRecipient("ana@example.com");
  const recipientById = await service.findActivePasswordResetRecipientById("user-1");
  assert.deepEqual(credentials, { id: "user-1", passwordHash: "hash-interno", status: UserStatus.ACTIVE });
  assert.deepEqual(active, { id: "user-1", role: "USER", capabilities: [], status: UserStatus.ACTIVE });
  assert.equal(active && "passwordHash" in active, false);
  assert.deepEqual(recipient, { id: "user-1", email: "ana@example.com" });
  assert.deepEqual(recipientById, { id: "user-1", email: "ana@example.com" });
});
