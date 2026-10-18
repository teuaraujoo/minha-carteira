import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import type { RegisterUserInput } from "../../src/modules/users/application/dto/register-user.dto.js";
import { UserService } from "../../src/modules/users/application/services/users.service.js";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";

const createdAt = new Date("2026-05-10T12:00:00.000Z");
const storage = { upload: async () => undefined, delete: async () => undefined, getPresignedUrl: async () => "", getActiveFileUrl: async () => null, replaceFileContent: async () => ({ file: {} as never, url: "", expiresAt: createdAt }) } satisfies StorageOperations;
function service(repository: ReturnType<typeof createUsersRepositoryDouble>, passwordHasher: { hash(password: string): Promise<string>; compare(password: string, hash: string): Promise<boolean> }, id = "generated-user-id") {
  return new UserService(repository, storage, { debug() { }, info() { }, warn() { }, error() { }, fatal() { }, async close() { } }, passwordHasher, { generate: () => id }, { now: () => new Date(createdAt.getTime()) });
}
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
  const userService = service(
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
    "generated-user-id",
  );

  const result = await userService.registerUser(validInput);

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
    const userService = service(
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
      "unused-id",
    );

    await assert.rejects(userService.registerUser(validInput), (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT);
    assert.equal(hashCalls, 0);
    assert.equal(saveCalls, 0);
  }
});

test("surfaces a persistence identity conflict to protect against registration races", async () => {
  const conflict = new AppError({ status: 409, code: ErrorCode.CONFLICT, message: "Conflito persistido." });
  const userService = service(createUsersRepositoryDouble({ save: async () => { throw conflict; } }),
    { async hash() { return "bcrypt-hash"; }, async compare() { return false; } },
    "generated-user-id",
  );

  await assert.rejects(userService.registerUser(validInput), error => error === conflict);
});

test("allows distinct users to share the same phone number", async () => {
  let saveCalls = 0;
  const userService = service(
    createUsersRepositoryDouble({
      findByEmail: async () => null,
      findByUsername: async () => null,
      save: async () => { saveCalls++; },
    }),
    { async hash() { return "bcrypt-hash"; }, async compare() { return false; } },
    "another-user-id",
  );

  const result = await userService.registerUser({
    ...validInput,
    username: "another-user",
    email: "another@example.com",
  });

  assert.equal(result.phone, validInput.phone);
  assert.equal(saveCalls, 1);
});

test("does not persist when the password hasher returns an empty hash", async () => {
  let saveCalls = 0;
  const userService = service(
    createUsersRepositoryDouble({ save: async () => { saveCalls++; } }),
    { async hash() { return ""; }, async compare() { return false; } },
    "generated-user-id",
  );

  await assert.rejects(userService.registerUser(validInput), {
    message: "O hash da senha é obrigatório.",
  });
  assert.equal(saveCalls, 0);
});
