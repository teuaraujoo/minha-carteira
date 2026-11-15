import assert from "node:assert/strict";
import test from "node:test";
import { Category, normalizeCategoryName } from "../../src/modules/categories/domain/entities/category.entity.js";
import { CategoryStatus } from "../../src/modules/categories/domain/enums/category.enums.js";

const now = new Date("2026-11-15T12:00:00.000Z");
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";

test("Category.create normaliza nome, cor, ícone e inicializa estado padrão ativo", () => {
  const category = Category.create({
    id: "33333333-3333-4333-8333-333333333333",
    userId: ownerId,
    name: "  Assinaturas Digitais  ",
    color: " #5b21b6 ",
    icon: "   ",
    now,
  });

  assert.equal(category.name, "Assinaturas Digitais");
  assert.equal(category.normalizedName, "assinaturas digitais");
  assert.equal(category.color, "#5B21B6");
  assert.equal(category.icon, null);
  assert.equal(category.isDefault, false);
  assert.equal(category.userId, ownerId);
  assert.equal(category.status, CategoryStatus.ACTIVE);
  assert.equal(category.isAccessibleBy(ownerId), true);
  assert.equal(category.isAccessibleBy(otherUserId), false);
  assert.equal(normalizeCategoryName("  Assinaturas Digitais  "), "assinaturas digitais");
});

test("Category rejeita nomes curtos/longos, cores inválidas e inconsistência de isDefault", () => {
  assert.throws(() => Category.create({ userId: ownerId, name: "A", now }));
  assert.throws(() => Category.create({ userId: ownerId, name: "a".repeat(61), now }));
  assert.throws(() => Category.create({ userId: ownerId, name: "Mercado", color: "verde", now }));
  assert.throws(() => Category.create({ userId: ownerId, name: "Mercado", color: "#12345", now }));
  assert.throws(() => Category.create({ userId: ownerId, name: "Mercado", icon: "x".repeat(41), now }));

  assert.throws(() =>
    new Category({
      id: "44444444-4444-4444-8444-444444444444",
      userId: ownerId,
      name: "Padrão Inválida",
      color: null,
      icon: null,
      isDefault: true,
      status: CategoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }),
  );

  assert.throws(() =>
    new Category({
      id: "55555555-5555-4555-8555-555555555555",
      userId: null,
      name: "Personalizada Sem Dono",
      color: null,
      icon: null,
      isDefault: false,
      status: CategoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }),
  );
});

test("Category protege categorias padrão do sistema contra edição, inativação e reativação", () => {
  const defaultCategory = new Category({
    id: "66666666-6666-4666-8666-666666666666",
    userId: null,
    name: "Alimentação",
    color: "#015363",
    icon: "utensils",
    isDefault: true,
    status: CategoryStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(defaultCategory.isAccessibleBy(ownerId), true);
  assert.equal(defaultCategory.isAccessibleBy(otherUserId), true);
  assert.throws(() => defaultCategory.updateDetails({ name: "Comida" }, now), /padrão do sistema/i);
  assert.throws(() => defaultCategory.deactivate(now), /padrão do sistema/i);
  assert.throws(() => defaultCategory.reactivate(now), /padrão do sistema/i);
});

test("Category controla ciclo de vida via status ACTIVE/INACTIVE em categorias personalizadas", () => {
  const category = Category.create({
    userId: ownerId,
    name: "Viagens",
    color: "#0f766e",
    icon: "plane",
    now,
  });

  const t1 = new Date("2026-11-15T12:05:00.000Z");
  category.updateDetails({ name: "Viagens e Férias", color: null, icon: "compass" }, t1);
  assert.equal(category.name, "Viagens e Férias");
  assert.equal(category.color, null);
  assert.equal(category.icon, "compass");

  const t2 = new Date("2026-11-15T12:10:00.000Z");
  category.deactivate(t2);
  assert.equal(category.status, CategoryStatus.INACTIVE);
  assert.throws(() => category.deactivate(t2), /já está inativa/i);

  const t3 = new Date("2026-11-15T12:15:00.000Z");
  category.reactivate(t3);
  assert.equal(category.status, CategoryStatus.ACTIVE);
  assert.throws(() => category.reactivate(t3), /já está ativa/i);
});
