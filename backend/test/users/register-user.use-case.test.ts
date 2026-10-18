import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { UserIdentityConflictError } from "../../src/modules/users/domain/errors/user-identity-conflict.error.js";
import type { RegisterUserInput } from "../../src/modules/users/application/dto/register-user.dto.js";
import { RegisterUserUseCase } from "../../src/modules/users/application/use-cases/register-user.use-case.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";

const createdAt = new Date("2026-05-10T12:00:00.000Z");
const validInput: RegisterUserInput = {
  username: " NewUser ",
  name: " New User ",
  email: " NEW@EXAMPLE.COM ",
  phone: "+5585999999999",
  password: "  password with spaces  ",
};

function existingUser(overrides: Partial<{
  username: string;
  email: string;
  phone: string;
}> = {}): User {
  return User.create({
    id: "existing-user",
    username: overrides.username ?? "existing-user",
    name: "Existing User",
    email: overrides.email ?? "existing@example.com",
    phone: overrides.phone ?? "+5585999999999",
    passwordHash: "existing-hash",
    createdAt,
  });
}

test("registers a normalized active USER and returns no password hash", async () => {
  let hashedPassword: string | undefined;
  let savedUser: User | undefined;
  const useCase = new RegisterUserUseCase(
    createUsersRepositoryDouble({
      async findByEmail(email) {
        assert.equal(email, "new@example.com");
        return null;
      },
      async findByUsername(username) {
        assert.equal(username, "newuser");
        return null;
      },
      async save(user) {
        savedUser = user;
      },
    }),
    {
      async hash(password) {
        hashedPassword = password;
        return "bcrypt-hash";
      },
      async compare() { return false; },
    },
    { generate: () => "generated-user-id" },
    { now: () => new Date(createdAt.getTime()) },
  );

  const result = await useCase.execute(validInput);

  assert.equal(hashedPassword, validInput.password);
  assert.equal(savedUser?.id, "generated-user-id");
  assert.equal(savedUser?.username, "newuser");
  assert.equal(savedUser?.name, "New User");
  assert.equal(savedUser?.email, "new@example.com");
  assert.equal(savedUser?.passwordHash, "bcrypt-hash");
  assert.equal(savedUser?.role, "USER");
  assert.equal(savedUser?.status, "ACTIVE");
  assert.equal(savedUser?.inactivatedAt, null);
  assert.equal(savedUser?.createdAt.getTime(), createdAt.getTime());
  assert.equal(result.id, "generated-user-id");
  assert.equal("passwordHash" in result, false);
  assert.equal("password" in result, false);
});

test("rejects normalized duplicate email or username before hashing", async () => {
  for (const duplicate of ["email", "username"] as const) {
    let hashCalls = 0;
    let saveCalls = 0;
    const useCase = new RegisterUserUseCase(
      createUsersRepositoryDouble({
        findByEmail: async (email) => duplicate === "email" && email === "new@example.com"
          ? existingUser({ email: "new@example.com" })
          : null,
        findByUsername: async (username) => duplicate === "username" && username === "newuser"
          ? existingUser({ username: "newuser" })
          : null,
        save: async () => { saveCalls++; },
      }),
      {
        async hash() { hashCalls++; return "unused-hash"; },
        async compare() { return false; },
      },
      { generate: () => "unused-id" },
      { now: () => new Date(createdAt.getTime()) },
    );

    await assert.rejects(useCase.execute(validInput), (error: unknown) => {
      assert.ok(error instanceof UserIdentityConflictError);
      assert.equal(error.field, duplicate);
      return true;
    });
    assert.equal(hashCalls, 0);
    assert.equal(saveCalls, 0);
  }
});

test("surfaces a persistence identity conflict to protect against registration races", async () => {
  const conflict = new UserIdentityConflictError("username");
  const useCase = new RegisterUserUseCase(
    createUsersRepositoryDouble({ save: async () => { throw conflict; } }),
    { async hash() { return "bcrypt-hash"; }, async compare() { return false; } },
    { generate: () => "generated-user-id" },
    { now: () => new Date(createdAt.getTime()) },
  );

  await assert.rejects(useCase.execute(validInput), error => error === conflict);
});

test("allows distinct users to share the same phone number", async () => {
  let saveCalls = 0;
  const useCase = new RegisterUserUseCase(
    createUsersRepositoryDouble({
      findByEmail: async () => null,
      findByUsername: async () => null,
      save: async () => { saveCalls++; },
    }),
    { async hash() { return "bcrypt-hash"; }, async compare() { return false; } },
    { generate: () => "another-user-id" },
    { now: () => new Date(createdAt.getTime()) },
  );

  const result = await useCase.execute({
    ...validInput,
    username: "another-user",
    email: "another@example.com",
  });

  assert.equal(result.phone, validInput.phone);
  assert.equal(saveCalls, 1);
});

test("does not persist when the password hasher returns an empty hash", async () => {
  let saveCalls = 0;
  const useCase = new RegisterUserUseCase(
    createUsersRepositoryDouble({ save: async () => { saveCalls++; } }),
    { async hash() { return ""; }, async compare() { return false; } },
    { generate: () => "generated-user-id" },
    { now: () => new Date(createdAt.getTime()) },
  );

  await assert.rejects(useCase.execute(validInput), {
    message: "O hash da senha é obrigatório.",
  });
  assert.equal(saveCalls, 0);
});
