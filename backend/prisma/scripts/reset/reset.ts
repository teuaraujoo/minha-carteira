import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Pool } from "pg";
import { createPinoAppLogger } from "../../../src/shared/infrastructure/logging/pino-app-logger.js";
import { resetApplicationData, resetConfirmation, resolveMaintenanceTarget } from "../database-maintenance.js";

const logger = createPinoAppLogger({ pretty: false });

try {
  const target = resolveMaintenanceTarget(process.env);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Execute o reset em um terminal interativo para confirmar o banco de destino.");
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let confirmation: string;
  try {
    confirmation = await terminal.question(
      `Todos os dados de ${target.hostname}/${target.database}, schema ${target.schema}, serão apagados.\n` +
      `As tabelas, migrations e objetos do R2 serão preservados.\nDigite ${resetConfirmation(target)} para confirmar: `,
    );
  } finally { terminal.close(); }
  if (confirmation !== resetConfirmation(target)) throw new Error("Reset cancelado: confirmação incorreta.");
  const pool = new Pool({ connectionString: target.connectionString });
  try {
    const client = await pool.connect();
    try {
      const deleted = await resetApplicationData(client, target, confirmation);
      const summary = Object.entries(deleted).map(([table, count]) => `${table}: ${count}`).join(", ");
      logger.info({ event: "database.reset.completed", module: "database", message: `Dados removidos; tabelas e histórico das migrations preservados. Registros por tabela: ${summary}.` });
    } finally { client.release(); }
  } finally { await pool.end(); }
} catch (error) {
  logger.error({ event: "database.reset.failed", module: "database", message: "Não foi possível concluir o reset do banco.", error });
  process.exitCode = 1;
} finally { await logger.close(); }
