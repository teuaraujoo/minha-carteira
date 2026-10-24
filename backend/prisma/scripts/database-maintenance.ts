import type { PoolClient } from "pg";

export const REQUIRED_TABLES = [
  "users", "stored_files", "refresh_tokens", "password_reset_requests", "challenges",
] as const;

export const RESET_TABLES = [
  "challenges", "messaging_identities", "password_reset_requests", "refresh_tokens", "stored_files", "users",
] as const;

export interface MaintenanceTarget {
  connectionString: string;
  database: string;
  hostname: string;
  schema: string;
}

export function resolveMaintenanceTarget(environment: NodeJS.ProcessEnv): MaintenanceTarget {
  if (!["development", "test", "staging"].includes(environment.NODE_ENV ?? "")) {
    throw new Error("Seed e reset exigem NODE_ENV=development, test ou staging; produção não é permitida.");
  }
  const value = environment.STG_DATABASE_URL?.trim();
  if (!value) throw new Error("A variável STG_DATABASE_URL é obrigatória; DATABASE_URL não será utilizada como alternativa.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("STG_DATABASE_URL deve conter uma URL PostgreSQL válida."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("STG_DATABASE_URL deve usar o protocolo postgres ou postgresql.");
  }
  let database: string;
  try { database = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error("O nome do banco em STG_DATABASE_URL é inválido."); }
  const schema = url.searchParams.get("schema") || "public";
  if (!database || !url.hostname || /[\x00-\x1f\x7f]/.test(database + schema + url.hostname)) {
    throw new Error("STG_DATABASE_URL deve informar host, banco e schema válidos.");
  }
  url.searchParams.delete("schema");
  return { connectionString: url.toString(), database, hostname: url.hostname, schema };
}

export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function resetConfirmation(target: MaintenanceTarget): string {
  return `APAGAR ${target.database}/${target.schema}`;
}

export async function listApplicationTables(client: Pick<PoolClient, "query">, schema: string): Promise<string[]> {
  const result = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1",
    [schema],
  );
  const tables = result.rows.map(row => row.tablename);
  const missing = REQUIRED_TABLES.filter(table => !tables.includes(table));
  if (missing.length) throw new Error(`Aplique as migrations antes de continuar. Tabelas ausentes: ${missing.join(", ")}.`);
  const unknown = tables.filter(table => table !== "_prisma_migrations" && !(RESET_TABLES as readonly string[]).includes(table));
  if (unknown.length) throw new Error("O schema contém tabelas não previstas; revise os scripts antes de continuar.");
  return tables;
}

export async function resetApplicationData(
  client: Pick<PoolClient, "query">,
  target: MaintenanceTarget,
  confirmation: string,
): Promise<Record<string, number>> {
  if (confirmation !== resetConfirmation(target)) throw new Error("Reset cancelado: a confirmação não corresponde ao banco e ao schema selecionados.");
  await client.query("BEGIN");
  try {
    const tables = await listApplicationTables(client, target.schema);
    const deleted: Record<string, number> = {};
    for (const table of RESET_TABLES) {
      if (!tables.includes(table)) continue;
      const result = await client.query(`DELETE FROM ${quoteIdentifier(target.schema)}.${quoteIdentifier(table)}`);
      deleted[table] = result.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return deleted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
