import assert from "node:assert/strict";
import test from "node:test";
import { User, type UserProps } from "../../src/modules/users/domain/entities/users.entity.js";
import {
  UserCapabilities,
  UserRoles,
  UserStatus,
} from "../../src/modules/users/domain/enums/users.enums.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

function createUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    id: "user-1",
    username: " teco ",
    name: " Teco ",
    email: " TECO@EXAMPLE.COM ",
    phone: " +5585999999999 ",
    role: UserRoles.ADMIN,
    passwordHash: "hash",
    capabilities: [UserCapabilities.TELEGRAM_MESSAGES],
    status: UserStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
    inactivatedAt: null,
    ...overrides,
  });
}

test("rehydrates a normalized user with defensive values and typed fields", () => {
  const user = createUser();

  assert.equal(user.id, "user-1");
  assert.equal(user.username, "teco");
  assert.equal(user.name, "Teco");
  assert.equal(user.email, "teco@example.com");
  assert.equal(user.phone, "+5585999999999");
  assert.equal(user.role, UserRoles.ADMIN);
  assert.equal(user.passwordHash, "hash");
  assert.equal(JSON.stringify(user).includes("hash"), false);
  assert.equal(user.status, UserStatus.ACTIVE);
  assert.equal(user.isActive(), true);
  assert.equal(user.inactivatedAt, null);

  const capabilities = user.capabilities;
  capabilities.length = 0;
  assert.deepEqual(user.capabilities, [UserCapabilities.TELEGRAM_MESSAGES]);

  const returnedCreatedAt = user.createdAt;
  returnedCreatedAt.setTime(0);
  assert.equal(user.createdAt.getTime(), createdAt.getTime());
});

test("creates a public user with USER role, active status, and no capabilities", () => {
  const user = User.create({
    id: "user-2",
    username: " NewUser ",
    name: " New User ",
    email: " NEW@EXAMPLE.COM ",
    phone: "+5585999999999",
    passwordHash: "hash",
    createdAt,
  });

  assert.equal(user.role, UserRoles.USER);
  assert.deepEqual(user.capabilities, []);
  assert.equal(user.status, UserStatus.ACTIVE);
  assert.equal(user.inactivatedAt, null);
  assert.equal(user.createdAt.getTime(), user.updatedAt.getTime());
  assert.equal(user.username, "newuser");
  assert.equal(user.email, "new@example.com");
});

test("changes lifecycle timestamps deterministically and preserves no-op transitions", () => {
  const user = createUser();
  const deactivatedAt = new Date("2026-01-02T00:00:00.000Z");

  user.deactivate(deactivatedAt);
  assert.equal(user.status, UserStatus.INACTIVE);
  assert.equal(user.isActive(), false);
  assert.equal(user.updatedAt.getTime(), deactivatedAt.getTime());
  assert.equal(user.inactivatedAt?.getTime(), deactivatedAt.getTime());

  const updatedAfterDeactivation = user.updatedAt.getTime();
  user.deactivate(new Date("2026-01-03T00:00:00.000Z"));
  assert.equal(user.updatedAt.getTime(), updatedAfterDeactivation);
  assert.equal(user.inactivatedAt?.getTime(), deactivatedAt.getTime());

  const activatedAt = new Date("2026-01-04T00:00:00.000Z");
  user.activate(activatedAt);
  assert.equal(user.status, UserStatus.ACTIVE);
  assert.equal(user.inactivatedAt, null);
  assert.equal(user.updatedAt.getTime(), activatedAt.getTime());
});

test("changes capabilities once and uses deterministic update dates", () => {
  const user = createUser({ capabilities: [] });
  const grantedAt = new Date("2026-01-02T00:00:00.000Z");

  user.grantCapability(UserCapabilities.TELEGRAM_MESSAGES, grantedAt);
  user.grantCapability(UserCapabilities.TELEGRAM_MESSAGES, new Date("2026-01-03T00:00:00.000Z"));
  assert.equal(user.hasCapability(UserCapabilities.TELEGRAM_MESSAGES), true);
  assert.deepEqual(user.capabilities, [UserCapabilities.TELEGRAM_MESSAGES]);
  assert.equal(user.updatedAt.getTime(), grantedAt.getTime());

  const revokedAt = new Date("2026-01-04T00:00:00.000Z");
  user.revokeCapability(UserCapabilities.TELEGRAM_MESSAGES, revokedAt);
  assert.equal(user.hasCapability(UserCapabilities.TELEGRAM_MESSAGES), false);
  assert.equal(user.updatedAt.getTime(), revokedAt.getTime());
});

test("changes the password hash without exposing it in serialized output", () => {
  const user = createUser();
  const changedAt = new Date("2026-01-02T00:00:00.000Z");

  user.changePasswordHash("new-hash", changedAt);
  assert.equal(user.passwordHash, "new-hash");
  assert.equal(user.updatedAt.getTime(), changedAt.getTime());
  assert.equal(JSON.stringify(user).includes("new-hash"), false);
});

test("updates only approved profile fields and preserves the hash", () => {
  const user = createUser();
  user.updateProfile({ name: "Nome Atualizado", phone: "+5585998888888" }, new Date("2026-01-02T00:00:00.000Z"));

  assert.equal(user.name, "Nome Atualizado");
  assert.equal(user.phone, "+5585998888888");
  assert.equal(user.passwordHash, "hash");
  assert.equal(user.updatedAt.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("rejects phone numbers outside the approved Brazilian mobile format", () => {
  assert.throws(() => createUser({ phone: "+558599999999" }), /Telefone deve seguir o formato de celular brasileiro/);
  assert.throws(() => createUser({ phone: "+5585888888888" }), /Telefone deve seguir o formato de celular brasileiro/);

  const user = createUser();
  assert.throws(
    () => user.updateProfile({ phone: "5585888888888" }, new Date("2026-01-02T00:00:00.000Z")),
    /Telefone deve seguir o formato de celular brasileiro/,
  );
  assert.equal(user.phone, "+5585999999999");
});

test("rejects invalid fields, enums, dates, lifecycle timestamps, and capabilities", () => {
  assert.throws(() => createUser({ id: " " }), TypeError);
  assert.throws(() => createUser({ username: "user@domain" }), /Nome de usuário não pode conter @/);
  assert.throws(() => createUser({ email: "invalid-email" }), TypeError);
  assert.throws(() => createUser({ phone: " " }), TypeError);
  assert.throws(() => createUser({ role: "GUEST" as UserRoles }), TypeError);
  assert.throws(() => createUser({ status: "BLOCKED" as UserStatus }), TypeError);
  assert.throws(() => createUser({ capabilities: ["INVALID"] as unknown as UserCapabilities[] }), TypeError);
  assert.throws(() => createUser({
    capabilities: [UserCapabilities.TELEGRAM_MESSAGES, UserCapabilities.TELEGRAM_MESSAGES],
  }), TypeError);
  assert.throws(() => createUser({
    capabilities: Array(1) as UserCapabilities[],
  }), TypeError);
  assert.throws(() => createUser({ createdAt: new Date("invalid") }), TypeError);
  assert.throws(() => createUser({
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: createdAt,
  }), RangeError);
  assert.throws(() => createUser({
    status: UserStatus.INACTIVE,
    inactivatedAt: null,
  }), TypeError);
  assert.throws(() => createUser({
    status: UserStatus.ACTIVE,
    inactivatedAt: new Date("2026-01-02T00:00:00.000Z"),
  }), TypeError);
});

test("rejects lifecycle changes with an invalid or older timestamp", () => {
  const user = createUser();
  assert.throws(() => user.deactivate(new Date("invalid")), TypeError);
  assert.throws(() => user.deactivate(new Date("2025-12-31T23:59:59.000Z")), RangeError);
  assert.equal(user.status, UserStatus.ACTIVE);
});
