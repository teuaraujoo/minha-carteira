import assert from "node:assert/strict";
import test from "node:test";
import { Account, normalizeAccountName } from "../../src/modules/accounts/domain/entities/account.entity.js";
import { AccountStatus, AccountType } from "../../src/modules/accounts/domain/enums/account.enums.js";

const now = new Date("2026-11-15T12:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";

test("Account.create inicializa currentBalance igual a initialBalance e normaliza campos opcionais", () => {
  const account = Account.create({
    id: "22222222-2222-4222-8222-222222222222",
    userId,
    name: "  Conta Nubank  ",
    type: AccountType.DIGITAL,
    brand: "  mastercard  ",
    institution: "   ",
    color: " #8a05be ",
    initialBalance: -0,
    now,
  });

  assert.equal(account.name, "Conta Nubank");
  assert.equal(account.normalizedName, "conta nubank");
  assert.equal(account.brand, "mastercard");
  assert.equal(account.institution, null);
  assert.equal(account.color, "#8A05BE");
  assert.equal(account.initialBalance, 0);
  assert.equal(account.currentBalance, 0);
  assert.equal(account.status, AccountStatus.ACTIVE);
  assert.equal(account.inactivatedAt, null);
  assert.equal(normalizeAccountName("  Conta Nubank  "), "conta nubank");
});

test("Account rejeita initialBalance negativo, não finito ou com mais de 2 casas decimais", () => {
  for (const invalidBalance of [-0.01, -100, Number.NaN, Number.POSITIVE_INFINITY, 10.123]) {
    assert.throws(() =>
      Account.create({
        userId,
        name: "Carteira",
        type: AccountType.CASH,
        initialBalance: invalidBalance,
        now,
      }),
    );
  }
});

test("Account rejeita cor fora do formato #RRGGBB e nomes inválidos", () => {
  assert.throws(() =>
    Account.create({
      userId,
      name: "A",
      type: AccountType.CHECKING,
      initialBalance: 100,
      now,
    }),
  );

  assert.throws(() =>
    Account.create({
      userId,
      name: "N".repeat(81),
      type: AccountType.CHECKING,
      initialBalance: 100,
      now,
    }),
  );

  for (const invalidColor of ["#FFF", "8A05BE", "#GGGGGG", "rgb(0,0,0)"]) {
    assert.throws(() =>
      Account.create({
        userId,
        name: "Conta Válida",
        type: AccountType.CHECKING,
        color: invalidColor,
        initialBalance: 100,
        now,
      }),
    );
  }
});

test("Account.updateDetails preserva initialBalance e currentBalance e aceita limpeza de campos opcionais", () => {
  const account = Account.create({
    userId,
    name: "Conta XP",
    type: AccountType.INVESTMENT,
    brand: "visa",
    institution: "XP Investimentos",
    color: "#0F172A",
    initialBalance: 5000.25,
    now,
  });

  const later = new Date(now.getTime() + 60_000);
  account.updateDetails(
    {
      name: "  XP Corretora ",
      type: AccountType.SAVINGS,
      brand: null,
      institution: "",
      color: "#1e293b",
    },
    later,
  );

  assert.equal(account.name, "XP Corretora");
  assert.equal(account.type, AccountType.SAVINGS);
  assert.equal(account.brand, null);
  assert.equal(account.institution, null);
  assert.equal(account.color, "#1E293B");
  assert.equal(account.initialBalance, 5000.25);
  assert.equal(account.currentBalance, 5000.25);
  assert.equal(account.updatedAt.getTime(), later.getTime());
});

test("Account.deactivate e Account.reactivate validam transições de estado e invariante de inactivatedAt", () => {
  const account = Account.create({
    userId,
    name: "Conta Inter",
    type: AccountType.DIGITAL,
    initialBalance: 150,
    now,
  });

  assert.throws(() => account.reactivate(now), /já está ativa/);

  const deactivatedAt = new Date(now.getTime() + 1000);
  account.deactivate(deactivatedAt);
  assert.equal(account.status, AccountStatus.INACTIVE);
  assert.equal(account.inactivatedAt?.getTime(), deactivatedAt.getTime());
  assert.throws(() => account.deactivate(deactivatedAt), /já está inativa/);

  const reactivatedAt = new Date(now.getTime() + 2000);
  account.reactivate(reactivatedAt);
  assert.equal(account.status, AccountStatus.ACTIVE);
  assert.equal(account.inactivatedAt, null);
  assert.equal(account.updatedAt.getTime(), reactivatedAt.getTime());

  assert.throws(() =>
    new Account({
      ...account.toJSON(),
      status: AccountStatus.INACTIVE,
      inactivatedAt: null,
    }),
  );

  assert.throws(() =>
    new Account({
      ...account.toJSON(),
      status: AccountStatus.ACTIVE,
      inactivatedAt: now,
    }),
  );
});
