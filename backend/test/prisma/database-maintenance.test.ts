import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { REQUIRED_TABLES, RESET_TABLES, quoteIdentifier, resetApplicationData, resetConfirmation, resolveMaintenanceTarget } from "../../prisma/scripts/database-maintenance.js";

const target = resolveMaintenanceTarget({ NODE_ENV: "test", STG_DATABASE_URL: "postgresql://localhost/demo?schema=test_schema" });

function createClient(tables: readonly string[], failOn?: string) {
  const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  const query = async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql === failOn) throw new Error("Violação de chave estrangeira simulada.");
    return sql.startsWith("SELECT")
      ? { rows: tables.map(tablename => ({ tablename })), rowCount: tables.length }
      : { rows: [], rowCount: sql.startsWith("DELETE") ? 2 : null };
  };
  return { client: { query } as unknown as Pick<PoolClient, "query">, calls };
}

test("manutenção rejeita produção, ambiente ausente e alternativa DATABASE_URL", () => {
  for (const NODE_ENV of [undefined, "", "production"]) {
    assert.throws(() => resolveMaintenanceTarget({ NODE_ENV, STG_DATABASE_URL: "postgres://localhost/demo" }), /produção/);
  }
  assert.throws(() => resolveMaintenanceTarget({ NODE_ENV: "test", DATABASE_URL: "postgres://localhost/demo" }), /STG_DATABASE_URL é obrigatória/);
  for (const value of ["invalid", "https://localhost/demo", "postgres://localhost/", "postgres://localhost/demo?schema=%00"]) {
    assert.throws(() => resolveMaintenanceTarget({ NODE_ENV: "test", STG_DATABASE_URL: value }));
  }
});

test("manutenção resolve o schema selecionado sem enviar o parâmetro Prisma ao pg", () => {
  const resolved = resolveMaintenanceTarget({ NODE_ENV: "staging", STG_DATABASE_URL: "postgres://localhost/demo%20db?schema=isolated&sslmode=require" });
  assert.equal(resolved.database, "demo db");
  assert.equal(resolved.schema, "isolated");
  assert.equal(new URL(resolved.connectionString).searchParams.has("schema"), false);
  assert.equal(new URL(resolved.connectionString).searchParams.get("sslmode"), "require");
  assert.equal(resolveMaintenanceTarget({ NODE_ENV: "development", STG_DATABASE_URL: "postgres://localhost/demo" }).schema, "public");
  assert.equal(quoteIdentifier('schema"; DROP TABLE users;--'), '"schema""; DROP TABLE users;--"');
});

test("confirmação incorreta do reset não envia nenhuma consulta", async () => {
  const { client, calls } = createClient(REQUIRED_TABLES);
  await assert.rejects(resetApplicationData(client, target, "APAGAR outro/public"), /confirmação/);
  assert.deepEqual(calls, []);
});

for (const [name, tables, message] of [
  ["tabela obrigatória ausente", REQUIRED_TABLES.filter(table => table !== "users"), /Tabelas ausentes/],
  ["tabela desconhecida", [...REQUIRED_TABLES, "unrelated_data"], /tabelas não previstas/],
] as const) {
  test(`reset reverte antes de excluir quando há ${name}`, async () => {
    const { client, calls } = createClient(tables);
    await assert.rejects(resetApplicationData(client, target, resetConfirmation(target)), message);
    assert.equal(calls[0]?.sql, "BEGIN");
    assert.equal(calls.at(-1)?.sql, "ROLLBACK");
    assert.equal(calls.some(call => /DELETE|COMMIT/.test(call.sql)), false);
  });
}

test("falha de chave estrangeira reverte a transação sem confirmar exclusões", async () => {
  const failedDelete = 'DELETE FROM "test_schema"."refresh_tokens"';
  const { client, calls } = createClient(RESET_TABLES, failedDelete);
  await assert.rejects(resetApplicationData(client, target, resetConfirmation(target)), /chave estrangeira/);
  assert.equal(calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(calls.some(call => call.sql === "COMMIT" || call.sql.endsWith('."users"')), false);
});

for (const messagingPresent of [true, false]) {
  test(`reset exclui dependentes primeiro e preserva migrations (mensageria=${messagingPresent})`, async () => {
    const tables = RESET_TABLES.filter(table => messagingPresent || table !== "messaging_identities");
    const { client, calls } = createClient([...tables, "_prisma_migrations"]);
    const deleted = await resetApplicationData(client, target, resetConfirmation(target));
    assert.deepEqual(calls.filter(call => call.sql.startsWith("DELETE")).map(call => call.sql), tables.map(table => `DELETE FROM "test_schema"."${table}"`));
    assert.deepEqual(deleted, Object.fromEntries(tables.map(table => [table, 2])));
    assert.deepEqual(calls[1]?.values, ["test_schema"]);
    assert.equal(calls.at(-1)?.sql, "COMMIT");
    assert.equal(calls.some(call => /TRUNCATE|DROP|ALTER|CREATE|_prisma_migrations/.test(call.sql)), false);
  });
}
