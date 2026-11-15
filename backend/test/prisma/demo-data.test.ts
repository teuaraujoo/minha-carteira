import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import bcrypt from "bcrypt";
import {
  createDefaultCategories,
  createDemoAccounts,
  createDemoHistory,
  createDemoTransactions,
  createDemoUsers,
  DEFAULT_CATEGORY_DEFINITIONS,
  DEMO_AVATAR,
  DEMO_USERS,
} from "../../prisma/scripts/data/demo-data.js";
import { Account } from "../../src/modules/accounts/domain/entities/account.entity.js";
import { Category } from "../../src/modules/categories/domain/entities/category.entity.js";
import { Transaction } from "../../src/modules/transactions/domain/entities/transaction.entity.js";
import { Challenge } from "../../src/modules/auth/domain/entities/challenge.entity.js";
import { RefreshToken } from "../../src/modules/auth/domain/entities/refresh-token.entity.js";
import { UserCapabilities } from "../../src/modules/users/domain/enums/users.enums.js";
import { validateStoredFile } from "../../src/modules/storage/domain/validation/file-validation.js";

const now = new Date("2026-10-23T12:00:00.000Z");

test("usuários de demonstração possuem hashes bcrypt, permissões e nenhuma senha em texto", async () => {
  const passwords = { admin: "Admin de teste!23", user: "Usuário de teste!23" };
  const users = await createDemoUsers(passwords, { hash: password => bcrypt.hash(password, 4), compare: bcrypt.compare }, now);
  assert.equal(users.length, 4);
  assert.equal(new Set(users.map(user => user.id)).size, 4);
  for (const user of users) {
    const definition = DEMO_USERS.find(candidate => candidate.id === user.id)!;
    assert.equal(user.role, definition.role);
    assert.equal(user.status, definition.status);
    assert.deepEqual(user.capabilities, definition.capabilities);
    assert.equal(await bcrypt.compare(user.role === "ADMIN" ? passwords.admin : passwords.user, user.passwordHash), true);
    assert.equal(bcrypt.getRounds(user.passwordHash), 4);
    assert.equal(await bcrypt.compare("senha incorreta", user.passwordHash), false);
    assert.equal(Object.hasOwn(user, "password"), false);
    assert.equal(user.inactivatedAt instanceof Date, user.status === "INACTIVE");
  }
  const serialized = JSON.stringify(users);
  assert.equal(serialized.includes(passwords.admin), false);
  assert.equal(serialized.includes(passwords.user), false);
  assert.equal(users.filter(user => user.role === "ADMIN").length, 1);
  assert.equal(users.filter(user => Array.isArray(user.capabilities) && user.capabilities.includes(UserCapabilities.TELEGRAM_MESSAGES)).length, 1);
});

test("todas as senhas de demonstração são validadas antes de gerar hashes", async () => {
  for (const passwords of [{ admin: "short", user: "valid password" }, { admin: "valid password", user: "short" }]) {
    let calls = 0;
    await assert.rejects(createDemoUsers(passwords, { hash: async () => { calls++; return "unused"; }, compare: async () => false }, now));
    assert.equal(calls, 0);
  }
});

test("avatar de demonstração passa no validador e possui chunks PNG íntegros", () => {
  const result = validateStoredFile(DEMO_AVATAR, "image/png");
  assert.equal(result.sizeInBytes, DEMO_AVATAR.length);
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
  assert.deepEqual(DEMO_AVATAR.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 8;
  while (offset < DEMO_AVATAR.length) {
    assert.ok(offset + 12 <= DEMO_AVATAR.length, "O cabeçalho do chunk deve estar completo.");
    const size = DEMO_AVATAR.readUInt32BE(offset);
    const end = offset + 12 + size;
    assert.ok(end <= DEMO_AVATAR.length, "O conteúdo do chunk deve estar completo.");
    const type = DEMO_AVATAR.toString("ascii", offset + 4, offset + 8);
    let crc = 0xffffffff;
    for (const byte of DEMO_AVATAR.subarray(offset + 4, offset + 8 + size)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, DEMO_AVATAR.readUInt32BE(offset + 8 + size), `CRC inválido no chunk ${type}.`);
    chunks.push({ type, data: DEMO_AVATAR.subarray(offset + 8, offset + 8 + size) });
    offset = end;
  }
  assert.equal(offset, DEMO_AVATAR.length);
  assert.equal(chunks[0]?.type, "IHDR");
  const header = chunks[0]!.data;
  assert.equal(header.length, 13);
  assert.equal(header.readUInt32BE(0), 1);
  assert.equal(header.readUInt32BE(4), 1);
  assert.deepEqual([...header.subarray(8)], [8, 6, 0, 0, 0]);
  assert.equal(chunks.at(-1)?.type, "IEND");
  assert.equal(chunks.at(-1)?.data.length, 0);
  const image = inflateSync(Buffer.concat(chunks.filter(chunk => chunk.type === "IDAT").map(chunk => chunk.data)));
  assert.equal(image.length, 5);
  assert.ok(image[0]! <= 4, "O filtro da linha PNG deve ser válido.");
});

test("histórico de demonstração contém apenas autenticações expiradas ou consumidas", () => {
  const history = createDemoHistory(now);
  for (const props of history.challenges) {
    const challenge = new Challenge(props as unknown as ConstructorParameters<typeof Challenge>[0]);
    assert.equal(challenge.isUsableAt(now), false);
    assert.ok(challenge.expiresAt < now);
    assert.match(challenge.secretHash, /^[a-f0-9]{64}$/);
    assert.equal(challenge.consumedAt !== null, challenge.status === "COMPLETED");
  }
  assert.equal(history.challenges[0]?.subjectType, "USER");
  assert.equal(history.challenges[0]?.subjectId, history.refreshToken.userId);
  assert.ok(history.refreshToken.revokedAt instanceof Date);
  assert.ok(history.refreshToken.expiresAt instanceof Date && history.refreshToken.expiresAt < now);
  assert.match(history.refreshToken.tokenHash, /^[a-f0-9]{64}$/);
  const session = new RefreshToken(history.refreshToken as ConstructorParameters<typeof RefreshToken>[0]);
  assert.equal(session.isActiveAt(now), false);
});

test("contas financeiras de demonstração respeitam invariantes de domínio e pertencem ao usuário padrão", () => {
  const accounts = createDemoAccounts(now);
  assert.equal(accounts.length, 3);
  assert.equal(new Set(accounts.map(account => account.id)).size, 3);
  for (const props of accounts) {
    const account = new Account({
      id: props.id,
      userId: props.userId,
      name: props.name,
      type: props.type as Account["type"],
      brand: props.brand ?? null,
      institution: props.institution ?? null,
      color: props.color ?? null,
      initialBalance: Number(props.initialBalance),
      currentBalance: Number(props.currentBalance),
      status: props.status as Account["status"],
      inactivatedAt: (props.inactivatedAt as Date | null | undefined) ?? null,
      createdAt: props.createdAt as Date,
      updatedAt: props.updatedAt as Date,
    });
    assert.equal(account.userId, DEMO_USERS[1]!.id);
    assert.ok(account.initialBalance >= 0);
  }
  assert.equal(accounts.filter(account => account.status === "ACTIVE").length, 2);
  assert.equal(accounts.filter(account => account.status === "INACTIVE").length, 1);
});

test("categorias padrão do seed cobrem 16 itens agnósticos de tipo com cores e ícones válidos", () => {
  const categories = createDefaultCategories(now);
  assert.equal(categories.length, DEFAULT_CATEGORY_DEFINITIONS.length);
  assert.equal(categories.length, 16);
  assert.equal(new Set(categories.map(category => category.id)).size, 16);
  assert.equal(new Set(categories.map(category => category.name.toLowerCase())).size, 16);
  for (const props of categories) {
    const category = new Category({
      id: props.id,
      userId: (props.userId as string | null | undefined) ?? null,
      name: props.name,
      color: (props.color as string | null | undefined) ?? null,
      icon: (props.icon as string | null | undefined) ?? null,
      isDefault: Boolean(props.isDefault),
      status: props.status as Category["status"],
      createdAt: props.createdAt as Date,
      updatedAt: props.updatedAt as Date,
    });
    assert.equal(category.isDefault, true);
    assert.equal(category.userId, null);
    assert.equal(category.status, "ACTIVE");
  }
});

test("transações de demonstração respeitam invariantes de domínio e pertencem ao usuário padrão", () => {
  const transactions = createDemoTransactions(now);
  assert.equal(transactions.length, 3);
  assert.equal(new Set(transactions.map(tx => tx.id)).size, 3);
  for (const props of transactions) {
    const entity = new Transaction({
      id: props.id,
      userId: props.userId,
      accountId: props.accountId,
      categoryId: (props.categoryId as string | null | undefined) ?? null,
      description: props.description,
      amount: Number(props.amount),
      type: props.type as Transaction["type"],
      status: props.status as Transaction["status"],
      transactionDate: (props.transactionDate as Date).toISOString().slice(0, 10),
      notes: (props.notes as string | null | undefined) ?? null,
      confirmedAt: (props.confirmedAt as Date | null | undefined) ?? null,
      createdAt: props.createdAt as Date,
      updatedAt: props.updatedAt as Date,
      deletedAt: (props.deletedAt as Date | null | undefined) ?? null,
    });
    assert.equal(entity.userId, DEMO_USERS[1]!.id);
    assert.ok(entity.amount > 0);
  }
  assert.equal(transactions.filter(tx => tx.status === "CONFIRMED").length, 2);
  assert.equal(transactions.filter(tx => tx.status === "PENDING").length, 1);
});
