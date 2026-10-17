import assert from "node:assert/strict";
import test from "node:test";
import { createUserSchema } from "../../src/modules/users/presentation/schemas/users.schemas.js";

test("parses and normalizes the public create-user input", () => {
  const result = createUserSchema.parse({
    username: " teco ",
    name: " Teco ",
    email: " TECO@EXAMPLE.COM ",
    phone: " +5585999999999 ",
    password: " password with spaces ",
  });

  assert.deepEqual(result, {
    username: "teco",
    name: "Teco",
    email: "teco@example.com",
    phone: "+5585999999999",
    password: " password with spaces ",
  });
});

test("rejects missing, empty, and invalid public fields", () => {
  const validInput = {
    username: "teco",
    name: "Teco",
    email: "teco@example.com",
    phone: "+5585999999999",
    password: "password",
  };

  for (const field of Object.keys(validInput)) {
    const input = { ...validInput } as Record<string, string>;
    delete input[field];
    assert.equal(createUserSchema.safeParse(input).success, false);
  }

  for (const field of ["username", "name", "email", "phone", "password"]) {
    assert.equal(
      createUserSchema.safeParse({ ...validInput, [field]: "   " }).success,
      false,
    );
  }

  for (const field of Object.keys(validInput)) {
    assert.equal(
      createUserSchema.safeParse({ ...validInput, [field]: 42 }).success,
      false,
    );
  }

  assert.equal(
    createUserSchema.safeParse({ ...validInput, email: "invalid-email" })
      .success,
    false,
  );

  const emptyNameResult = createUserSchema.safeParse({
    ...validInput,
    name: "   ",
  });
  assert.equal(emptyNameResult.success, false);
  if (!emptyNameResult.success) {
    assert.equal(emptyNameResult.error.issues[0]?.message, "Nome é obrigatório.");
  }
});

test("rejects administrative and persistence fields from the public input", () => {
  const validInput = {
    username: "teco",
    name: "Teco",
    email: "teco@example.com",
    phone: "+5585999999999",
    password: "password",
  };

  const forbiddenFields: Record<string, unknown> = {
    passwordHash: "client-controlled-hash",
    capabilities: ["TELEGRAM_TRANSACTIONS"],
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    unknownField: "unknown-value",
  };

  for (const [field, value] of Object.entries(forbiddenFields)) {
    assert.equal(
      createUserSchema.safeParse({ ...validInput, [field]: value }).success,
      false,
    );
  }
});
