import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../../src/modules/users/domain/entities/users.entity.js";
import { UserCapabilities, UserRoles, UserStatus } from "../../src/modules/users/domain/enums/users.enums.js";
import { AppError, ErrorCode } from "../../src/shared/presentation/http/app-error.js";
import type { PrismaUsersClient } from "../../src/modules/users/infrastructure/repositories/users.repository.js";
import { PrismaUsersRepository } from "../../src/modules/users/infrastructure/repositories/users.repository.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

interface FakeUserRecord {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoles;
  passwordHash: string;
  capabilities: UserCapabilities[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
}

interface FakePrismaClient {
  user: {
    findUnique(args: { where: Record<string, unknown> }): Promise<FakeUserRecord | null>;
    findFirst(args: { where: Record<string, unknown> }): Promise<FakeUserRecord | null>;
    findMany(args: { where: Record<string, unknown>; skip?: number; take?: number }): Promise<FakeUserRecord[]>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
    upsert(args: { where: { id: string }; create: FakeUserRecord; update: Partial<FakeUserRecord> }): Promise<FakeUserRecord>;
    delete(args: { where: { id: string } }): Promise<void>;
  };
}

function record(overrides: Partial<FakeUserRecord> = {}): FakeUserRecord {
  return {
    id: "user-1",
    username: "ana",
    name: "Ana",
    email: "ana@example.com",
    phone: "+5511999999999",
    role: UserRoles.ADMIN,
    passwordHash: "hash-secreto",
    capabilities: [UserCapabilities.TELEGRAM_MESSAGES],
    status: UserStatus.ACTIVE,
    createdAt,
    updatedAt: createdAt,
    inactivatedAt: null,
    ...overrides,
  };
}

function createPrismaFake(initial: ReturnType<typeof record>[] = []) {
  const rows = [...initial];
  const calls: Array<{ method: string; args: unknown }> = [];
  const match = (row: ReturnType<typeof record>, where: Record<string, unknown>): boolean => {
    if (where.OR && Array.isArray(where.OR)) {
      return where.OR.some((condition) => match(row, condition as Record<string, unknown>));
    }
    return Object.entries(where).every(([key, value]) => {
      if (key === "inactivatedAt" && value && typeof value === "object" && "lt" in value) {
        return row.inactivatedAt !== null && row.inactivatedAt < (value as { lt: Date }).lt;
      }
      return row[key as keyof typeof row] === value;
    });
  };
  const prisma: FakePrismaClient = {
    user: {
      async findUnique(args) {
        calls.push({ method: "findUnique", args });
        return rows.find(row => match(row, args.where)) ?? null;
      },
      async findFirst(args) {
        calls.push({ method: "findFirst", args });
        return rows.find(row => match(row, args.where)) ?? null;
      },
      async findMany(args) {
        calls.push({ method: "findMany", args });
        const result = rows.filter(row => match(row, args.where));
        return result.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? result.length));
      },
      async count(args) {
        calls.push({ method: "count", args });
        return rows.filter(row => match(row, args.where)).length;
      },
      async upsert(args) {
        calls.push({ method: "upsert", args });
        const existingIndex = rows.findIndex(row => row.id === args.where.id);
        const saved: FakeUserRecord = existingIndex < 0
          ? args.create
          : { ...rows[existingIndex]!, ...args.update };
        if (existingIndex < 0) rows.push(saved);
        else rows[existingIndex] = saved;
        return saved;
      },
      async delete(args) {
        calls.push({ method: "delete", args });
        const index = rows.findIndex(row => row.id === args.where.id);
        if (index >= 0) rows.splice(index, 1);
      },
    },
  };
  return { prisma: prisma as unknown as PrismaUsersClient, rawPrisma: prisma, rows, calls };
}

test("repository reidrata os campos e consulta usuários ativos e por identidade normalizada", async () => {
  const fake = createPrismaFake([record()]);
  const repository = new PrismaUsersRepository(fake.prisma);

  const found = await repository.findById("user-1");
  assert.ok(found);
  assert.equal(found.role, UserRoles.ADMIN);
  assert.deepEqual(found.capabilities, [UserCapabilities.TELEGRAM_MESSAGES]);
  assert.equal(found.passwordHash, "hash-secreto");
  assert.equal((await repository.findActiveById("user-1"))?.status, UserStatus.ACTIVE);
  assert.equal((await repository.findByEmail(" ANA@EXAMPLE.COM "))?.id, "user-1");
  assert.equal((await repository.findByUsername(" ANA "))?.id, "user-1");
  await repository.findByIdentifier(" ANA@EXAMPLE.COM ");

  assert.deepEqual(fake.calls.at(-1), {
    method: "findFirst",
    args: { where: { OR: [{ email: "ana@example.com" }, { username: "ana@example.com" }] } },
  });
});

test("repository persiste estado completo e traduz conflito único de identidade", async () => {
  const fake = createPrismaFake();
  const repository = new PrismaUsersRepository(fake.prisma);
  const user = User.create({
    id: "user-2",
    username: " Ana ",
    name: " Ana Silva ",
    email: " ANA@EXAMPLE.COM ",
    phone: "+5511999999999",
    passwordHash: "hash",
    createdAt,
  });

  await repository.save(user);
  assert.equal(fake.rows[0]?.username, "ana");
  assert.equal(fake.rows[0]?.email, "ana@example.com");
  assert.equal(fake.rows[0]?.phone, "+5511999999999");
  assert.equal(fake.rows[0]?.role, UserRoles.USER);
  assert.deepEqual(fake.rows[0]?.capabilities, []);

  const conflictFake = createPrismaFake();
  conflictFake.rawPrisma.user.upsert = async () => {
    throw { code: "P2002", meta: { target: ["email"] } };
  };
  await assert.rejects(
    new PrismaUsersRepository(conflictFake.prisma).save(user),
    (error: unknown) => error instanceof AppError && error.status === 409 && error.code === ErrorCode.CONFLICT,
  );
});

test("repository pagina usuários inativos anteriores à data de corte e exclui por ID", async () => {
  const fake = createPrismaFake([
    record({ id: "inactive-1", status: UserStatus.INACTIVE, inactivatedAt: new Date("2025-01-01T00:00:00.000Z") }),
    record({ id: "inactive-2", status: UserStatus.INACTIVE, inactivatedAt: new Date("2025-02-01T00:00:00.000Z") }),
    record({ id: "active", status: UserStatus.ACTIVE, inactivatedAt: null }),
  ]);
  const repository = new PrismaUsersRepository(fake.prisma);
  const result = await repository.findInactiveBefore(new Date("2025-03-01T00:00:00.000Z"), {
    page: 2,
    pageSize: 1,
    offset: 1,
  });

  assert.deepEqual(result.items.map(user => user.id), ["inactive-2"]);
  assert.deepEqual(result.pagination, { page: 2, pageSize: 1, total: 2, totalPages: 2 });
  await repository.deleteById("inactive-2");
  assert.equal(fake.rows.some(row => row.id === "inactive-2"), false);
});
