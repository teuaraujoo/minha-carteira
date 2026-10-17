import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import {
  UserCapabilities,
  UserStatus,
} from "../../src/modules/users/domain/enums/users.enums.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

function createUser(): User {
  return new User({
    id: "user-1",
    username: " teco ",
    name: " Teco ",
    email: "TECO@EXAMPLE.COM",
    phone: " +5585999999999 ",
    passwordHash: "hash",
    capabilities: [UserCapabilities.TELEGRAM_MESSAGES],
    status: UserStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  });
}

test("constructs a user with normalized fields and defensive values", () => {
  const user = createUser();

  assert.equal(user.id, "user-1");
  assert.equal(user.username, "teco");
  assert.equal(user.name, "Teco");
  assert.equal(user.email, "teco@example.com");
  assert.equal(user.phone, "+5585999999999");
  assert.equal(user.passwordHash, "hash");
  assert.equal(JSON.stringify(user).includes("hash"), false);
  assert.equal(user.status, UserStatus.ACTIVE);
  assert.equal(user.isActive(), true);

  const capabilities = user.capabilities as UserCapabilities[];
  capabilities.length = 0;
  assert.deepEqual(user.capabilities, [
    UserCapabilities.TELEGRAM_MESSAGES,
  ]);

  const returnedCreatedAt = user.createdAt;
  returnedCreatedAt.setTime(0);
  assert.equal(user.createdAt.getTime(), createdAt.getTime());
});

test("changes status and capabilities without duplicating no-op mutations", () => {
  const user = createUser();

  user.deactivate();
  assert.equal(user.status, UserStatus.INACTIVE);
  assert.equal(user.isActive(), false);
  assert.ok(user.updatedAt > createdAt);

  const updatedAfterDeactivation = user.updatedAt.getTime();
  user.deactivate();
  assert.equal(user.updatedAt.getTime(), updatedAfterDeactivation);

  user.revokeCapability(UserCapabilities.TELEGRAM_MESSAGES);
  assert.equal(
    user.hasCapability(UserCapabilities.TELEGRAM_MESSAGES),
    false,
  );

  user.grantCapability(UserCapabilities.TELEGRAM_MESSAGES);
  user.grantCapability(UserCapabilities.TELEGRAM_MESSAGES);
  assert.deepEqual(user.capabilities, [
    UserCapabilities.TELEGRAM_MESSAGES,
  ]);

  user.activate();
  assert.equal(user.status, UserStatus.ACTIVE);
});

test("rejects invalid required fields, enums, dates, and duplicated capabilities", () => {
  const validProps = {
    id: "user-1",
    username: "teco",
    name: "Teco",
    email: "teco@example.com",
    phone: "+5585999999999",
    passwordHash: "hash",
    capabilities: [] as UserCapabilities[],
    status: UserStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  assert.throws(() => new User({ ...validProps, id: " " }), TypeError);
  assert.throws(
    () => new User({ ...validProps, email: "invalid-email" }),
    TypeError,
  );
  assert.throws(
    () => new User({ ...validProps, phone: "" }),
    TypeError,
  );
  assert.throws(
    () =>
      new User({
        ...validProps,
        capabilities: [
          UserCapabilities.TELEGRAM_MESSAGES,
          UserCapabilities.TELEGRAM_MESSAGES,
        ],
      }),
    TypeError,
  );
  assert.throws(
    () =>
      new User({
        ...validProps,
        capabilities: Array(1) as UserCapabilities[],
      }),
    TypeError,
  );
  assert.throws(
    () =>
      new User({
        ...validProps,
        status: "BLOCKED" as UserStatus,
      }),
    TypeError,
  );
  assert.throws(
    () => new User({ ...validProps, createdAt: new Date("invalid") }),
    TypeError,
  );
  assert.throws(
    () =>
      new User({
        ...validProps,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    RangeError,
  );
});
