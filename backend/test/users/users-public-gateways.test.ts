import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { UserCapabilities, UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { UserNotFoundError } from "../../src/modules/users/domain/errors/user-not-found.error.js";
import type { UsersAuthGateway, UsersRegistrationGateway } from "../../src/modules/users/index.js";
import { UsersAuthGatewayAdapter } from "../../src/modules/users/infrastructure/adapters/users-auth-gateway.adapter.js";
import { UsersRegistrationGatewayAdapter } from "../../src/modules/users/infrastructure/adapters/users-registration-gateway.adapter.js";
import type { RegisterUserInput, RegisterUserOutput } from "../../src/modules/users/application/dto/register-user.dto.js";
import { RegisterUserUseCase } from "../../src/modules/users/application/use-cases/register-user.use-case.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const now = new Date("2026-02-01T00:00:00.000Z");

function createUser() {
  return User.create({
    id: "user-1",
    username: "ana",
    name: "Ana",
    email: "ana@example.com",
    phone: "+5511999999999",
    passwordHash: "hash-interno",
    createdAt,
  });
}

test("gateway de auth busca credenciais sem classificações próprias do identificador", async () => {
  const user = createUser();
  const requestedIdentifiers: string[] = [];
  const gateway: UsersAuthGateway = new UsersAuthGatewayAdapter(createUsersRepositoryDouble({
    findByIdentifier: async (identifier) => {
      requestedIdentifiers.push(identifier);
      return user;
    },
  }), { now: () => now });

  const credentials = await gateway.findCredentialsByIdentifier("ANA@EXAMPLE.COM");
  assert.deepEqual(requestedIdentifiers, ["ANA@EXAMPLE.COM"]);
  assert.deepEqual(credentials, { id: "user-1", passwordHash: "hash-interno", status: UserStatus.ACTIVE });
});

test("gateway de auth busca somente usuários ativos e não devolve hash nessa representação", async () => {
  const user = createUser();
  user.grantCapability(UserCapabilities.TELEGRAM_MESSAGES, now);
  let requestedId = "";
  const gateway: UsersAuthGateway = new UsersAuthGatewayAdapter(createUsersRepositoryDouble({
    findActiveById: async (id) => {
      requestedId = id;
      return user;
    },
  }), { now: () => now });

  const authUser = await gateway.findActiveUserById("user-1");
  assert.equal(requestedId, "user-1");
  assert.deepEqual(authUser, {
    id: "user-1",
    role: UserRoles.USER,
    capabilities: [UserCapabilities.TELEGRAM_MESSAGES],
    status: UserStatus.ACTIVE,
  });
  assert.equal(authUser && "passwordHash" in authUser, false);
});

test("gateway troca o hash com horário determinístico e informa usuário ausente", async () => {
  const user = createUser();
  const saved: { current: User | null } = { current: null };
  const gateway: UsersAuthGateway = new UsersAuthGatewayAdapter(createUsersRepositoryDouble({
    findById: async () => user,
    save: async (nextUser) => { saved.current = nextUser; },
  }), { now: () => now });

  await gateway.changePasswordHash("user-1", "novo-hash");
  assert.equal(saved.current?.passwordHash, "novo-hash");
  assert.equal(saved.current?.updatedAt.toISOString(), now.toISOString());

  const missingGateway = new UsersAuthGatewayAdapter(createUsersRepositoryDouble(), { now: () => now });
  await assert.rejects(missingGateway.changePasswordHash("ausente", "hash"), UserNotFoundError);
});

test("gateway de cadastro delega ao caso de uso e retorna somente a saída pública", async () => {
  const input: RegisterUserInput = {
    username: "ana",
    name: "Ana",
    email: "ana@example.com",
    phone: "+5511999999999",
    password: "senha segura",
  };
  const output: RegisterUserOutput = {
    id: "user-1",
    username: "ana",
    name: "Ana",
    email: "ana@example.com",
    phone: "+5511999999999",
    role: UserRoles.USER,
    capabilities: [],
    status: UserStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
    inactivatedAt: null,
  };
  let received: RegisterUserInput | null = null;
  const useCase = {
    async execute(value: RegisterUserInput): Promise<RegisterUserOutput> {
      received = value;
      return output;
    },
  } as Pick<RegisterUserUseCase, "execute">;
  const gateway: UsersRegistrationGateway = new UsersRegistrationGatewayAdapter(useCase);

  const result = await gateway.registerUser(input);
  assert.equal(received, input);
  assert.equal(result.id, "user-1");
  assert.equal("passwordHash" in result, false);
});
