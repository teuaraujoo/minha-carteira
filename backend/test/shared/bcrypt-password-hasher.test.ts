import assert from "node:assert/strict";
import test from "node:test";
import { BcryptPasswordHasher } from "../../src/shared/infrastructure/security/bcrypt-password-hasher.js";

test("BcryptPasswordHasher hashes and compares passwords without changing them", async () => {
  const hasher = new BcryptPasswordHasher(4);
  const password = "  senha com espaços  ";
  const passwordHash = await hasher.hash(password);

  assert.notEqual(passwordHash, password);
  assert.notEqual(passwordHash, await hasher.hash(password));
  assert.equal(await hasher.compare(password, passwordHash), true);
  assert.equal(await hasher.compare("senha com espaços", passwordHash), false);
});

test("BcryptPasswordHasher rejects an invalid cost", () => {
  assert.throws(() => new BcryptPasswordHasher(3), RangeError);
  assert.throws(() => new BcryptPasswordHasher(4.5), RangeError);
  assert.throws(() => new BcryptPasswordHasher(32), RangeError);
});
